import React, {useState, useEffect, useRef} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  PermissionsAndroid,
  Animated,
  Share,
} from 'react-native';
import RecordScreen, {RecordingResult} from 'react-native-record-screen';

interface RecordedVideo {
  id: string;
  uri: string;
  duration: number;
  createdAt: string;
  fps: number;
  mic: boolean;
}

export default function App(): React.JSX.Element {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [enableMic, setEnableMic] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(30);
  const [bitrate, setBitrate] = useState<number>(4000000); // 4 Mbps
  const [recordedVideos, setRecordedVideos] = useState<RecordedVideo[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to record');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      // Pulsing recording indicator animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

      return () => {
        pulse.stop();
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, pulseAnim]);

  const requestAndroidPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const permissionsToRequest: any[] = [];
      if (enableMic) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }

      if (Number(Platform.Version) < 33) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
      }

      if (permissionsToRequest.length === 0) return true;

      const results = await PermissionsAndroid.requestMultiple(
        permissionsToRequest,
      );
      const allGranted = Object.values(results).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED,
      );

      return allGranted;
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  };

  const handleStartRecording = async () => {
    try {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please grant microphone and storage permissions to record screen audio.',
        );
        return;
      }

      setStatusMessage('Requesting screen capture...');
      setRecordDuration(0);

      const res = await RecordScreen.startRecording({
        mic: enableMic,
        fps,
        bitrate,
      });

      if (res === RecordingResult.PermissionError) {
        setStatusMessage('Screen capture permission was denied.');
        Alert.alert(
          'Permission Denied',
          'Screen capture permission was not granted by user.',
        );
        setIsRecording(false);
        return;
      }

      setIsRecording(true);
      setStatusMessage('Recording screen in progress...');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setStatusMessage('Failed to start recording');
      Alert.alert(
        'Recording Error',
        error?.message || 'Failed to start screen recording. Note: iOS simulator does not support screen recording.',
      );
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      setStatusMessage('Saving recording...');
      const response = await RecordScreen.stopRecording();
      setIsRecording(false);

      if (response && response.status === 'success' && response.result?.outputURL) {
        const videoUri = response.result.outputURL;
        const newVideo: RecordedVideo = {
          id: Date.now().toString(),
          uri: videoUri,
          duration: recordDuration,
          createdAt: new Date().toLocaleTimeString(),
          fps,
          mic: enableMic,
        };

        setRecordedVideos(prev => [newVideo, ...prev]);
        setStatusMessage(`Saved: ${videoUri.split('/').pop()}`);
        Alert.alert(
          'Recording Saved Successfully!',
          `File location:\n${videoUri}`,
        );
      } else {
        setStatusMessage('Recording ended (no output)');
      }
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      setStatusMessage('Error stopping recording');
      setIsRecording(false);
      Alert.alert('Error', error?.message || 'Failed to stop screen recording.');
    }
  };

  const handleCleanCache = async () => {
    try {
      await RecordScreen.clean();
      setRecordedVideos([]);
      setStatusMessage('Temporary recording cache cleaned');
      Alert.alert('Cleaned', 'Temporary recording cache cleared successfully.');
    } catch (err: any) {
      Alert.alert('Clean Error', err?.message || 'Failed to clean cache.');
    }
  };

  const handleShareVideo = async (uri: string) => {
    try {
      await Share.share({
        title: 'Screen Recording',
        url: uri,
        message: `Check out my screen recording: ${uri}`,
      });
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Could not share video.');
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>🎬 Screen Recorder</Text>
          <Text style={styles.subtitle}>
            Capture high-quality screen videos with audio
          </Text>
        </View>

        {/* Status & Timer Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Animated.View
              style={[
                styles.recordingDot,
                {
                  backgroundColor: isRecording ? '#EF4444' : '#10B981',
                  opacity: pulseAnim,
                },
              ]}
            />
            <Text style={styles.statusBadgeText}>
              {isRecording ? 'RECORDING ACTIVE' : 'STANDBY'}
            </Text>
          </View>

          <Text style={styles.timerText}>{formatTimer(recordDuration)}</Text>
          <Text style={styles.statusSubtext}>{statusMessage}</Text>

          {/* Primary Action Button */}
          {isRecording ? (
            <TouchableOpacity
              style={[styles.mainButton, styles.stopButton]}
              onPress={handleStopRecording}
              activeOpacity={0.8}>
              <Text style={styles.buttonText}>⏹ Stop Recording</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, styles.startButton]}
              onPress={handleStartRecording}
              activeOpacity={0.8}>
              <Text style={styles.buttonText}>⏺ Start Recording</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Configuration Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Recording Settings</Text>

          {/* Microphone Audio Toggle */}
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Microphone Audio</Text>
              <Text style={styles.settingHint}>Record external voice/mic</Text>
            </View>
            <TouchableOpacity
              disabled={isRecording}
              style={[
                styles.toggleButton,
                enableMic ? styles.toggleActive : styles.toggleInactive,
              ]}
              onPress={() => setEnableMic(!enableMic)}>
              <Text
                style={[
                  styles.toggleText,
                  enableMic ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}>
                {enableMic ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Frame Rate Selection */}
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Frame Rate (FPS)</Text>
              <Text style={styles.settingHint}>Higher FPS is smoother</Text>
            </View>
            <View style={styles.pillGroup}>
              {[30, 60].map(val => (
                <TouchableOpacity
                  key={val}
                  disabled={isRecording}
                  style={[
                    styles.pillButton,
                    fps === val && styles.pillButtonActive,
                  ]}
                  onPress={() => setFps(val)}>
                  <Text
                    style={[
                      styles.pillText,
                      fps === val && styles.pillTextActive,
                    ]}>
                    {val} FPS
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quality / Bitrate Selection */}
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Video Quality</Text>
              <Text style={styles.settingHint}>Bitrate stream rate</Text>
            </View>
            <View style={styles.pillGroup}>
              {[
                {label: '4M', val: 4000000},
                {label: '8M', val: 8000000},
              ].map(item => (
                <TouchableOpacity
                  key={item.val}
                  disabled={isRecording}
                  style={[
                    styles.pillButton,
                    bitrate === item.val && styles.pillButtonActive,
                  ]}
                  onPress={() => setBitrate(item.val)}>
                  <Text
                    style={[
                      styles.pillText,
                      bitrate === item.val && styles.pillTextActive,
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Recorded Videos List */}
        <View style={styles.card}>
          <View style={styles.historyHeader}>
            <Text style={styles.cardTitle}>📁 Session Recordings</Text>
            {recordedVideos.length > 0 && (
              <TouchableOpacity onPress={handleCleanCache}>
                <Text style={styles.cleanText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recordedVideos.length === 0 ? (
            <Text style={styles.emptyText}>
              No recordings captured yet in this session.
            </Text>
          ) : (
            recordedVideos.map(video => (
              <View key={video.id} style={styles.videoItem}>
                <View style={styles.videoMeta}>
                  <Text style={styles.videoTitle}>
                    📹 {video.uri.split('/').pop()}
                  </Text>
                  <Text style={styles.videoDetails}>
                    Duration: {formatTimer(video.duration)} • {video.fps} FPS •{' '}
                    {video.mic ? 'Mic On' : 'Mic Off'} • {video.createdAt}
                  </Text>
                  <Text numberOfLines={1} style={styles.videoPath}>
                    {video.uri}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShareVideo(video.uri)}>
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Platform Notes Card */}
        <View style={styles.cardNotice}>
          <Text style={styles.noticeTitle}>💡 Platform Tips:</Text>
          <Text style={styles.noticeText}>
            • <Text style={styles.bold}>Android:</Text> A system prompt will
            request permission to start screen projection. Tap "Start now".
          </Text>
          <Text style={styles.noticeText}>
            • <Text style={styles.bold}>iOS:</Text> Screen recording requires a
            physical iOS device running iOS 11.0 or higher.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 44,
    fontWeight: '800',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  statusSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
    textAlign: 'center',
  },
  mainButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#3B82F6',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  settingLabel: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  settingHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleInactive: {
    backgroundColor: '#475569',
  },
  toggleText: {
    fontWeight: '700',
    fontSize: 13,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  toggleTextInactive: {
    color: '#CBD5E1',
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  pillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  pillButtonActive: {
    backgroundColor: '#3B82F6',
  },
  pillText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cleanText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 14,
  },
  videoItem: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoMeta: {
    flex: 1,
    marginRight: 10,
  },
  videoTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
  },
  videoDetails: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  videoPath: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  shareButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  cardNotice: {
    backgroundColor: '#172554',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  noticeTitle: {
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
  },
  noticeText: {
    color: '#BFDBFE',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  bold: {
    fontWeight: '700',
  },
});
