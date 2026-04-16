import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { isSafeExternalUrl } from '@/utils/url-safety';

/**
 * Mimics RN WebView for `source={{ html }}`, `onMessage`, and `injectJavaScript`
 * using an iframe + postMessage so Metro web bundles without native WebView code.
 */
function buildBridgeScript(parentOrigin: string) {
  return `<script>(function(){window.ReactNativeWebView={postMessage:function(m){try{window.parent.postMessage(typeof m==='string'?m:String(m),${JSON.stringify(parentOrigin)});}catch(e){}}};})();</script>`;
}

type WebLikeProps = {
  source?: { html?: string; uri?: string };
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onError?: (e: { nativeEvent: { description?: string } }) => void;
  onLoadEnd?: () => void;
  scrollEnabled?: boolean;
  javaScriptEnabled?: boolean;
  injectedJavaScriptBeforeContentLoaded?: string;
  originWhitelist?: string[];
  sharedCookiesEnabled?: boolean;
  thirdPartyCookiesEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
};

const ReaderWebView = forwardRef<{ injectJavaScript: (script: string) => void }, WebLikeProps>(
  function ReaderWebView(
    {
      source,
      style,
      onMessage,
      onError,
      onLoadEnd,
      scrollEnabled = true,
    }: WebLikeProps,
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const parentOrigin = useMemo(
      () => (typeof window !== 'undefined' ? window.location.origin : 'null'),
      []
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    const srcDoc = useMemo(() => {
      if (source && typeof source === 'object' && 'html' in source && source.html) {
        return buildBridgeScript(parentOrigin) + source.html;
      }
      return null;
    }, [parentOrigin, source]);

    const src = useMemo(() => {
      if (source && typeof source === 'object' && 'uri' in source && source.uri) {
        return isSafeExternalUrl(source.uri) ? source.uri : undefined;
      }
      return undefined;
    }, [source]);

    useImperativeHandle(
      ref,
      () => ({
        injectJavaScript(script: string) {
          try {
            const doc = iframeRef.current?.contentDocument;
            if (doc?.body) {
              const el = doc.createElement('script');
              el.type = 'text/javascript';
              el.text = script;
              doc.body.appendChild(el);
              doc.body.removeChild(el);
            }
          } catch (e) {
            onError?.({ nativeEvent: { description: String(e) } });
          }
        },
      }),
      [onError]
    );

    useEffect(() => {
      if (!onMessage || typeof window === 'undefined') return;
      const handler = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        if (event.origin !== 'null' && event.origin !== window.location.origin) return;
        const { data } = event;
        if (data == null || data === '') return;
        onMessage({ nativeEvent: { data: typeof data === 'string' ? data : String(data) } });
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [onMessage]);

    const flat = StyleSheet.flatten(style) as Record<string, unknown>;

    if (!mounted || (!srcDoc && !src)) {
      return <View style={[{ flex: 1 }, flat]} />;
    }

    return (
      <View style={[{ flex: 1, overflow: 'hidden' as const }, flat]}>
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc || undefined}
          src={src}
          title="Miyo reader"
          onLoad={() => onLoadEnd?.()}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
            overflow: scrollEnabled ? 'auto' : 'hidden',
            backgroundColor: (flat?.backgroundColor as string) || 'transparent',
          }}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
        />
      </View>
    );
  }
);

export default ReaderWebView;
