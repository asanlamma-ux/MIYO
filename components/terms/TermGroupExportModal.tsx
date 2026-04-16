import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { exportSelectedTermGroups } from '@/utils/term-group-io';
import { TermGroup } from '@/types/terms';
import {
  X,
  Upload,
  Download,
  FileText,
  Check,
  AlertTriangle,
  Globe2,
  CircleSlash,
  Share2,
  CheckSquare,
  Square,
} from 'lucide-react-native';

interface TermGroupExportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TermGroupExportModal({ visible, onClose }: TermGroupExportModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { termGroups, importGroups } = useTerms();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; error: string | null } | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isDark = currentTheme.isDark;

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    setSelectedGroupIds(next ? new Set(termGroups.map(g => g.id)) : new Set());
  };

  const groupsToExport: TermGroup[] = selectAll
    ? termGroups
    : termGroups.filter(g => selectedGroupIds.has(g.id));

  const handleExport = async () => {
    if (groupsToExport.length === 0) return;
    setExporting(true);
    const path = await exportSelectedTermGroups(groupsToExport);
    setExporting(false);
    if (path) {
      setExportedPath(path);
      setShowSuccessModal(true);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const result = await importGroups();
    setImporting(false);
    setImportResult(result);
  };

  const exportCount = groupsToExport.length;
  const exportTermCount = groupsToExport.reduce((s, g) => s + g.terms.length, 0);

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <View style={[styles.root, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Pressable style={styles.backdrop} onPress={onClose} />

          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.sheet,
              {
                backgroundColor: currentTheme.cardBackground,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                paddingBottom: Math.max(insets.bottom, 12) + 8,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />

            <View style={styles.header}>
              <View>
                <ThemedText variant="primary" size="header" weight="bold">
                  Manage Term Groups
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  Export, import, and sync your term groups
                </ThemedText>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <X size={22} color={currentTheme.secondaryText} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {/* Group selection */}
              {termGroups.length > 0 && (
                <View
                  style={[
                    styles.selectionCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderColor: currentTheme.secondaryText + '15',
                    },
                  ]}
                >
                  <View style={styles.selectionHeader}>
                    <ThemedText variant="primary" size="body" weight="semibold">
                      Select Groups to Export
                    </ThemedText>
                    <Pressable onPress={toggleSelectAll} style={styles.selectAllRow} hitSlop={8}>
                      {selectAll ? (
                        <CheckSquare size={18} color={currentTheme.accent} />
                      ) : (
                        <Square size={18} color={currentTheme.secondaryText} />
                      )}
                      <ThemedText variant="secondary" size="caption" style={{ marginLeft: 6 }}>
                        All
                      </ThemedText>
                    </Pressable>
                  </View>
                  {termGroups.map(g => {
                    const isSelected = selectAll || selectedGroupIds.has(g.id);
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => toggleGroup(g.id)}
                        style={styles.groupRow}
                      >
                        {isSelected ? (
                          <CheckSquare size={17} color={currentTheme.accent} />
                        ) : (
                          <Square size={17} color={currentTheme.secondaryText + '80'} />
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <ThemedText variant="primary" size="body" numberOfLines={1}>{g.name}</ThemedText>
                          <ThemedText variant="secondary" size="caption">{g.terms.length} term{g.terms.length !== 1 ? 's' : ''}</ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Export action */}
              <PressableScale
                onPress={handleExport}
                disabled={exporting || exportCount === 0}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: currentTheme.secondaryText + '15',
                    opacity: exportCount === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: currentTheme.accent + '15' }]}>
                  {exporting ? (
                    <ActivityIndicator size="small" color={currentTheme.accent} />
                  ) : (
                    <Upload size={20} color={currentTheme.accent} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="primary" size="body" weight="semibold">
                    Export to File
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption">
                    {exportCount > 0
                      ? `${exportCount} group${exportCount !== 1 ? 's' : ''} · ${exportTermCount} term${exportTermCount !== 1 ? 's' : ''}`
                      : 'Select at least one group'}
                  </ThemedText>
                </View>
              </PressableScale>

              {/* Import action */}
              <PressableScale
                onPress={handleImport}
                disabled={importing}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: currentTheme.secondaryText + '15',
                  },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}>
                  {importing ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Download size={20} color="#3B82F6" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="primary" size="body" weight="semibold">
                    Import from File
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption">
                    Load term groups from a Miyo export file
                  </ThemedText>
                </View>
              </PressableScale>

              {/* Cloud sync disabled notice */}
              <View
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: currentTheme.secondaryText + '15',
                    opacity: 0.76,
                  },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: currentTheme.accent + '15' }]}>
                  <CircleSlash size={20} color={currentTheme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="primary" size="body" weight="semibold">
                    Cloud Sync Unavailable
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption">
                    Google Drive term-group sync is disabled in this build.
                  </ThemedText>
                </View>
              </View>

              {/* Import result */}
              {importResult && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.resultCard}>
                  {importResult.error ? (
                    <>
                      <AlertTriangle size={18} color="#EF4444" />
                      <ThemedText variant="primary" size="caption" style={{ flex: 1, marginLeft: 8 }}>
                        {importResult.error}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <Check size={18} color="#22C55E" />
                      <ThemedText variant="primary" size="caption" style={{ flex: 1, marginLeft: 8 }}>
                        Imported {importResult.count} group{importResult.count !== 1 ? 's' : ''} successfully
                      </ThemedText>
                    </>
                  )}
                </Animated.View>
              )}

              {/* Browse community */}
              <PressableScale
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    (globalThis as any).__openCommunityGroups?.();
                  }, 300);
                }}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: currentTheme.secondaryText + '15',
                  },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#8B5CF615' }]}>
                  <Globe2 size={20} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="primary" size="body" weight="semibold">
                    Browse Community Groups
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption">
                    Discover and download shared term groups
                  </ThemedText>
                </View>
              </PressableScale>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Export Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
        statusBarTranslucent
      >
        <View style={[styles.root, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Pressable style={styles.backdrop} onPress={() => setShowSuccessModal(false)} />
          <Animated.View
            entering={FadeIn.duration(180)}
            style={[
              styles.successModal,
              { backgroundColor: currentTheme.cardBackground },
            ]}
          >
            <View style={[styles.successIconWrap, { backgroundColor: '#22C55E20' }]}>
              <Check size={32} color="#22C55E" />
            </View>
            <ThemedText variant="primary" size="header" weight="bold" style={styles.successTitle}>
              Export Successful
            </ThemedText>
            <ThemedText variant="secondary" size="body" style={styles.successSubtitle}>
              {exportCount} group{exportCount !== 1 ? 's' : ''} · {exportTermCount} term{exportTermCount !== 1 ? 's' : ''} exported
            </ThemedText>
            <View style={[styles.pathBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: currentTheme.secondaryText + '20' }]}>
              <FileText size={14} color={currentTheme.secondaryText} style={{ marginRight: 8 }} />
              <ThemedText variant="secondary" size="caption" numberOfLines={3} style={{ flex: 1, fontFamily: 'monospace' }}>
                {exportedPath ? exportedPath.split('/').pop() : 'miyo_terms.json'}
              </ThemedText>
            </View>
            <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginBottom: 20 }}>
              The share sheet was opened so you can save or send the file.
            </ThemedText>
            <PressableScale
              onPress={() => setShowSuccessModal(false)}
              style={[styles.successOkBtn, { backgroundColor: currentTheme.accent }]}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Done</ThemedText>
            </PressableScale>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  selectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginBottom: 10,
  },
  // Success modal
  successModal: {
    alignSelf: 'center',
    width: '88%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 24,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  pathBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    width: '100%',
  },
  successOkBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
});
