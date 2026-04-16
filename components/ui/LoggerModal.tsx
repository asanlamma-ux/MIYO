import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { logger, LogEntry, LogLevel } from '@/utils/logger';
import {
  X,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

interface LoggerModalProps {
  visible: boolean;
  onClose: () => void;
}

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { color: string; icon: React.ComponentType<{ size: number; color: string }> }
> = {
  debug: { color: '#6B7280', icon: Bug },
  info: { color: '#3B82F6', icon: Info },
  warn: { color: '#F59E0B', icon: AlertTriangle },
  error: { color: '#EF4444', icon: AlertCircle },
};

function LogEntryItem({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { currentTheme } = useTheme();
  const config = LOG_LEVEL_CONFIG[entry.level];
  const IconComponent = config.icon;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.logEntry,
        { 
          backgroundColor: currentTheme.cardBackground,
          borderLeftColor: config.color,
        },
      ]}
    >
      <View style={styles.logHeader}>
        <View style={styles.logHeaderLeft}>
          <IconComponent size={16} color={config.color} />
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: config.color + '20' },
            ]}
          >
            <ThemedText
              size="caption"
              weight="semibold"
              style={{ color: config.color }}
            >
              {entry.level.toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText variant="secondary" size="caption">
            {formatTime(entry.timestamp)}
          </ThemedText>
        </View>
        {(entry.details || entry.stack) && (
          isExpanded ? (
            <ChevronUp size={16} color={currentTheme.secondaryText} />
          ) : (
            <ChevronDown size={16} color={currentTheme.secondaryText} />
          )
        )}
      </View>

      <ThemedText
        variant="primary"
        size="body"
        numberOfLines={isExpanded ? undefined : 2}
        style={styles.logMessage}
      >
        {entry.message}
      </ThemedText>

      {isExpanded && entry.details != null ? (
        <View
          style={[
            styles.detailsContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <ThemedText variant="secondary" size="caption" weight="medium">
            Details:
          </ThemedText>
          <ThemedText
            variant="secondary"
            size="caption"
            style={styles.detailsText}
          >
            {typeof entry.details === 'object'
              ? JSON.stringify(entry.details, null, 2)
              : String(entry.details)}
          </ThemedText>
        </View>
      ) : null}

      {isExpanded && entry.stack && (
        <View
          style={[
            styles.detailsContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <ThemedText variant="secondary" size="caption" weight="medium">
            Stack Trace:
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stackScroll}
          >
            <ThemedText
              variant="secondary"
              size="caption"
              style={styles.stackText}
            >
              {entry.stack}
            </ThemedText>
          </ScrollView>
        </View>
      )}
    </Pressable>
  );
}

export function LoggerModal({ visible, onClose }: LoggerModalProps) {
  const { currentTheme } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');

  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredLogs =
    selectedLevel === 'all'
      ? logs
      : logs.filter(log => log.level === selectedLevel);

  const levelCounts = {
    all: logs.length,
    debug: logs.filter(l => l.level === 'debug').length,
    info: logs.filter(l => l.level === 'info').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: currentTheme.background },
        ]}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: currentTheme.secondaryText + '20' },
          ]}
        >
          <ThemedText variant="primary" size="header" weight="bold">
            Console Logs
          </ThemedText>
          <View style={styles.headerActions}>
            <PressableScale
              onPress={() => {
                logger.clearLogs();
                setExpandedIds(new Set());
              }}
              style={[
                styles.clearButton,
                { backgroundColor: '#EF444420' },
              ]}
            >
              <Trash2 size={16} color="#EF4444" />
              <ThemedText
                size="caption"
                weight="semibold"
                style={{ color: '#EF4444' }}
              >
                Clear
              </ThemedText>
            </PressableScale>
            <PressableScale onPress={onClose} style={styles.closeButton}>
              <X size={24} color={currentTheme.text} />
            </PressableScale>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => {
              const isSelected = selectedLevel === level;
              const count = levelCounts[level];
              const color =
                level === 'all'
                  ? currentTheme.accent
                  : LOG_LEVEL_CONFIG[level].color;

              return (
                <PressableScale
                  key={level}
                  onPress={() => setSelectedLevel(level)}
                  style={[
                    styles.filterTab,
                    {
                      backgroundColor: isSelected
                        ? color + '20'
                        : currentTheme.cardBackground,
                      borderColor: isSelected ? color : 'transparent',
                    },
                  ]}
                >
                  <ThemedText
                    size="caption"
                    weight={isSelected ? 'semibold' : 'regular'}
                    style={{ color: isSelected ? color : currentTheme.text }}
                  >
                    {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </ThemedText>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: color + '30' },
                    ]}
                  >
                    <ThemedText
                      size="caption"
                      weight="semibold"
                      style={{ color }}
                    >
                      {count}
                    </ThemedText>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>

        {/* Log List */}
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Info size={48} color={currentTheme.secondaryText} />
            <ThemedText
              variant="secondary"
              size="body"
              style={styles.emptyText}
            >
              No logs to display
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredLogs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <LogEntryItem
                entry={item}
                isExpanded={expandedIds.has(item.id)}
                onToggle={() => toggleExpanded(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButton: {
    padding: 4,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  logEntry: {
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logMessage: {
    lineHeight: 20,
  },
  detailsContainer: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  detailsText: {
    marginTop: 4,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackScroll: {
    marginTop: 4,
  },
  stackText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
  },
});
