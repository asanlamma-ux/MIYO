import React, { forwardRef } from 'react';
import WebView, { WebViewProps } from 'react-native-webview';

/**
 * Native WebView wrapper. On web, Metro resolves `ReaderWebView.web.tsx` instead
 * so `react-native-webview` (native codegen) is never bundled for web.
 */
const ReaderWebView = forwardRef<WebView, WebViewProps>(function ReaderWebView(props, ref) {
  return <WebView ref={ref} {...props} />;
});

export default ReaderWebView;
export type { WebViewProps as ReaderWebViewProps };
