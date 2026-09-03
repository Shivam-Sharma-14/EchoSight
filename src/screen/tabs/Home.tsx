import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Camera, useCameraDevice, useCameraFormat} from 'react-native-vision-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {prepareTts, speakText as speakWithTts, stopSpeaking} from '../../services/tts';
import {translations} from './localization';

type AppLanguage = keyof typeof translations;

const Home: React.FC = () => {
  const device = useCameraDevice('back');
  const photoFormat = useCameraFormat(device, [{photoResolution: {width: 1280, height: 720}}]);
  const camera = useRef<Camera>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [imageData, setImageData] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const savedLanguage = await AsyncStorage.getItem('userLanguage');
      if (savedLanguage === 'en' || savedLanguage === 'hi') {
        setLanguage(savedLanguage);
      }

      const permission = await Camera.requestCameraPermission();
      if (permission === 'denied') {
        Alert.alert(
          'Camera permission required',
          'Allow camera access in Android settings to use AI Vision.',
        );
      }
    };

    initialize().catch(error => console.warn('Initialization failed:', error));
  }, []);

  useEffect(() => {
    void prepareTts(language);
  }, [language]);

  const speakText = async (text: string) => {
    try {
      await speakWithTts(text, language);
    } catch (error) {
      console.warn('Text-to-speech unavailable:', error);
      Alert.alert('Voice unavailable', 'The description is still available to read on screen.');
    }
  };
  const openCamera = async () => {
    const currentPermission = await Camera.getCameraPermissionStatus();
    const permission = currentPermission === 'granted'
      ? currentPermission
      : await Camera.requestCameraPermission();

    if (permission !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'EchoSight needs the camera to describe what is around you.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Open Settings', onPress: () => Linking.openSettings()},
        ],
      );
      return;
    }

    setCameraReady(false);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraReady(false);
  };

  const analyzeImage = async (imageUri: string) => {
    setIsAnalyzing(true);
    setImageAnalysis('Analyzing your image…');
    setShowImageModal(true);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);
      formData.append('language', language);

      const response = await fetch('https://echosight-gemini-api.onrender.com/read-file', {
        method: 'POST',
        body: formData,
      });
      const responseText = await response.text();
      let result: any;

      try {
        result = JSON.parse(responseText);
      } catch {
        result = undefined;
      }

      if (!response.ok) {
        const serverMessage = typeof result?.error === 'string' ? result.error : null;
        throw new Error(serverMessage || `Analysis service returned ${response.status}. Please try again.`);
      }

      const description = result?.generatedText || result?.description || result?.text;
      if (typeof description !== 'string' || !description.trim()) {
        throw new Error('The analysis service returned no description.');
      }

      setImageAnalysis(description.trim());
      await speakText(description.trim());
    } catch (error) {
      console.info('Image analysis failed:', error);
      setImageAnalysis(
        error instanceof Error ? error.message : 'Unable to analyze this picture. Please try again.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePicture = async () => {
    if (!cameraReady || !camera.current || isCapturing) {
      Alert.alert('Camera is starting', 'Please wait a moment, then try again.');
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await camera.current.takePhoto({flash: 'off', enableShutterSound: false});
      const imageUri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      setImageData(imageUri);
      closeCamera();
      await analyzeImage(imageUri);
    } catch (error) {
      console.info('Photo capture failed:', error);
      Alert.alert(
        'Unable to take picture',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const closePreview = () => {
    void stopSpeaking();
    setShowImageModal(false);
    setImageData('');
    setImageAnalysis('');
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleBoxPress = (position: string) => {
    Alert.alert(translations[language].pressBox.replace('{position}', position));
  };

  const openContacts = () => {
    Linking.openURL(Platform.OS === 'ios' ? 'mailto:' : 'content://contacts/people/').catch(
      () => Alert.alert('Contacts unavailable', 'Could not open the contacts app.'),
    );
  };

  const openMessaging = () => {
    Linking.openURL('sms:+916230757220').catch(
      () => Alert.alert('Messages unavailable', 'Could not open the messaging app.'),
    );
  };

  if (device == null) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#2DD4BF" /></View>;
  }

  if (cameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          format={photoFormat}
          isActive
          photo
          photoQualityBalance="speed"
          onInitialized={() => setCameraReady(true)}
          onError={error => {
            console.warn('Camera error:', error);
            setCameraReady(false);
          }}
        />
        <TouchableOpacity style={styles.cancelCameraButton} onPress={closeCamera}>
          <Text style={styles.cancelCameraText}>Cancel</Text>
        </TouchableOpacity>
        {!cameraReady && <Text style={styles.cameraHint}>Starting camera…</Text>}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Take picture"
          disabled={!cameraReady || isCapturing}
          style={[styles.shutterButton, (!cameraReady || isCapturing) && styles.shutterDisabled]}
          onPress={takePicture}>
          <View style={styles.cameraShutter} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundImageContainer}>
        <Image source={require('../../assets/obscura-home-hero.png')} style={styles.backgroundImage} />
        <View style={styles.overlay} />
      </View>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2DD4BF" />}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Image source={require('../../assets/microphone-black-shape.png')} style={styles.brandIcon} />
          </View>
          <View>
            <Text style={styles.title}>EchoSight</Text>
            <Text style={styles.subtitle}>See more. Hear more.</Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => handleBoxPress('Voice help')}>
            <View style={[styles.iconCircle, styles.voiceIconCircle]}><Image source={require('../../assets/microphone-black-shape.png')} style={styles.actionIcon} /></View>
            <Text style={styles.actionTitle}>Voice help</Text><Text style={styles.actionDescription}>Listen for guidance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={openMessaging}>
            <View style={[styles.iconCircle, styles.messageIconCircle]}><Image source={require('../../assets/chat.png')} style={styles.actionIcon} /></View>
            <Text style={styles.actionTitle}>Messages</Text><Text style={styles.actionDescription}>Reach someone quickly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => handleBoxPress('QR scanner')}>
            <View style={[styles.iconCircle, styles.qrIconCircle]}><Image source={require('../../assets/qr-code.png')} style={styles.actionIcon} /></View>
            <Text style={styles.actionTitle}>Scan QR</Text><Text style={styles.actionDescription}>Read a code aloud</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={openContacts}>
            <View style={[styles.iconCircle, styles.contactIconCircle]}><Image source={require('../../assets/phone.png')} style={styles.actionIcon} /></View>
            <Text style={styles.actionTitle}>Contacts</Text><Text style={styles.actionDescription}>Call your support circle</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.captureButtonContainer} onPress={openCamera}>
          <View style={styles.captureButton}>
            <Text style={styles.captureEyebrow}>AI VISION</Text>
            <Text style={styles.captureText}>{translations[language].openCamera}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {showImageModal && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
              <Image source={{uri: imageData}} style={styles.previewImage} />
              <Text style={styles.analysisText}>{imageAnalysis}</Text>
            </ScrollView>
            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color="#F97316" />
                <Text style={styles.analyzingText}>Finding details and preparing voice guidance…</Text>
              </View>
            ) : (
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.listenButton} onPress={() => speakText(imageAnalysis)}>
                  <Text style={styles.listenButtonText}>Read aloud</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.retakeButton} onPress={() => { closePreview(); openCamera(); }}>
                  <Text style={styles.retakeButtonText}>Take another</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={closePreview}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#081B33'},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#081B33'},
  backgroundImageContainer: {...StyleSheet.absoluteFillObject},
  backgroundImage: {width: '100%', height: '100%', resizeMode: 'cover'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 20, 42, 0.36)'},
  contentContainer: {flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 36},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 30},
  brandMark: {width: 52, height: 52, borderRadius: 18, backgroundColor: '#2DD4BF', justifyContent: 'center', alignItems: 'center', marginRight: 13},
  brandIcon: {width: 23, height: 23, tintColor: '#06233E'},
  title: {color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 0.3},
  subtitle: {color: '#D7EAF4', fontSize: 14, fontWeight: '600', marginTop: 2},
  actionGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  actionCard: {width: '48%', minHeight: 138, borderRadius: 24, backgroundColor: 'rgba(5, 30, 55, 0.48)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.32)', padding: 16, marginBottom: 14},
  iconCircle: {width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 15},
  voiceIconCircle: {backgroundColor: 'rgba(45, 212, 191, 0.84)'},
  messageIconCircle: {backgroundColor: 'rgba(96, 165, 250, 0.84)'},
  qrIconCircle: {backgroundColor: 'rgba(251, 191, 36, 0.88)'},
  contactIconCircle: {backgroundColor: 'rgba(244, 114, 182, 0.84)'},
  actionIcon: {width: 22, height: 22, tintColor: '#082F49'},
  actionTitle: {color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 5},
  actionDescription: {color: '#E1EDF5', fontSize: 12, fontWeight: '500', lineHeight: 17},
  captureButtonContainer: {marginTop: 'auto', padding: 18, backgroundColor: '#F97316', borderRadius: 24},
  captureButton: {alignItems: 'center'},
  captureEyebrow: {color: '#FFF2E6', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 4},
  captureText: {color: '#FFFFFF', fontSize: 21, fontWeight: '800'},
  cameraScreen: {flex: 1, backgroundColor: '#000000'},
  shutterButton: {width: 68, height: 68, borderRadius: 34, backgroundColor: '#F97316', position: 'absolute', bottom: 42, alignSelf: 'center', justifyContent: 'center', alignItems: 'center'},
  shutterDisabled: {opacity: 0.55},
  cameraShutter: {width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF'},
  cameraHint: {position: 'absolute', bottom: 124, alignSelf: 'center', color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
  cancelCameraButton: {position: 'absolute', top: 54, right: 22, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(0, 0, 0, 0.55)'},
  cancelCameraText: {color: '#FFFFFF', fontWeight: '700'},
  modalContainer: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center'},
  modalContent: {width: '90%', maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, alignItems: 'center'},
  scrollViewContent: {flexGrow: 1, justifyContent: 'center', alignItems: 'center'},
  previewImage: {width: '100%', height: 300, resizeMode: 'contain', marginBottom: 10},
  analysisText: {fontSize: 16, color: '#333333', textAlign: 'center', marginBottom: 20},
  analyzingRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16},
  analyzingText: {flex: 1, color: '#52677B', fontSize: 14, fontWeight: '600'},
  resultActions: {flexDirection: 'row', width: '100%', gap: 10, marginBottom: 12},
  listenButton: {flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#0F766E', borderRadius: 12},
  listenButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
  retakeButton: {flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#0F766E', borderRadius: 12},
  retakeButtonText: {color: '#0F766E', fontSize: 15, fontWeight: '700'},
  closeButton: {paddingHorizontal: 22, paddingVertical: 12, backgroundColor: '#F97316', borderRadius: 12},
  closeButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
});

export default Home;
