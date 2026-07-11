import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
 
// Key yang digunakan untuk menyimpan data di AsyncStorage
const STORAGE_KEY = '@snapjourney_profile';
 
// Placeholder avatar jika user belum memilih foto
const PLACEHOLDER_AVATAR =
  'https://api.dicebear.com/7.x/initials/png?seed=SnapJourney&backgroundColor=8fc7ff';
 
/**
 * Mengubah kode cuaca dari Open-Meteo (WMO Weather Code)
 * menjadi teks + emoji yang mudah dibaca manusia.
 * Referensi: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
function getWeatherInfo(code) {
  const map = {
    0: { text: 'Cerah', icon: '☀️' },
    1: { text: 'Cerah Berawan', icon: '🌤' },
    2: { text: 'Berawan Sebagian', icon: '⛅' },
    3: { text: 'Mendung', icon: '☁️' },
    45: { text: 'Berkabut', icon: '🌫' },
    48: { text: 'Kabut Beku', icon: '🌫' },
    51: { text: 'Gerimis Ringan', icon: '🌦' },
    53: { text: 'Gerimis', icon: '🌦' },
    55: { text: 'Gerimis Lebat', icon: '🌧' },
    61: { text: 'Hujan Ringan', icon: '🌧' },
    63: { text: 'Hujan', icon: '🌧' },
    65: { text: 'Hujan Lebat', icon: '⛈' },
    71: { text: 'Salju Ringan', icon: '🌨' },
    73: { text: 'Salju', icon: '🌨' },
    75: { text: 'Salju Lebat', icon: '❄️' },
    80: { text: 'Hujan Lokal', icon: '🌦' },
    81: { text: 'Hujan Lokal Sedang', icon: '🌧' },
    82: { text: 'Hujan Lokal Deras', icon: '⛈' },
    95: { text: 'Badai Petir', icon: '⛈' },
    96: { text: 'Badai Petir + Hujan Es', icon: '⛈' },
    99: { text: 'Badai Petir Hebat', icon: '⛈' },
  };
  return map[code] || { text: 'Tidak Diketahui', icon: '🌡' };
}
 
/**
 * Format tanggal hari ini menjadi format Indonesia yang enak dibaca.
 * Contoh: "11 Juli 2026"
 */
function getFormattedDate() {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const now = new Date();
  return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}`;
}
 
export default function App() {
  // ------------------------------------------------------------------
  // STATE
  // ------------------------------------------------------------------
  const [photoUri, setPhotoUri] = useState(null); // uri foto profil
  const [name, setName] = useState('');           // nama pengguna
  const [location, setLocation] = useState(null); // { latitude, longitude }
  const [address, setAddress] = useState(null);   // hasil reverse geocoding
  const [weather, setWeather] = useState(null);   // { text, icon, temp }
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
 
  // ------------------------------------------------------------------
  // EFFECT: Load data tersimpan saat aplikasi pertama kali dibuka
  // ------------------------------------------------------------------
  useEffect(() => {
    loadSavedProfile();
  }, []);
 
  /**
   * Mengambil data profile yang tersimpan di AsyncStorage (jika ada)
   * dan menampilkannya kembali ke UI.
   */
  const loadSavedProfile = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setPhotoUri(data.photoUri || null);
        setName(data.name || '');
        if (data.latitude && data.longitude) {
          setLocation({ latitude: data.latitude, longitude: data.longitude });
        }
        setAddress(data.address || null);
      }
    } catch (error) {
      console.log('Gagal memuat data tersimpan:', error);
    }
  };
 
  // ------------------------------------------------------------------
  // PERMISSION FLOW HELPERS
  // ------------------------------------------------------------------
 
  /**
   * Menampilkan Alert yang mengarahkan user ke pengaturan aplikasi
   * ketika sebuah permission ditolak (denied).
   */
  const showPermissionDeniedAlert = (fitur) => {
    Alert.alert(
      'Izin Diperlukan',
      `Aplikasi memerlukan izin ${fitur} agar fitur ini dapat berjalan. Silakan aktifkan izin melalui Pengaturan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Buka Pengaturan',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  };
 
  // ------------------------------------------------------------------
  // FITUR: KAMERA & GALERI
  // ------------------------------------------------------------------
 
  /**
   * Menampilkan pilihan Alert: Kamera / Galeri / Batal
   * Ini adalah entry point utama untuk mengubah foto profil.
   */
  const handleChangePhoto = () => {
    Alert.alert('Ubah Foto', 'Pilih sumber foto profil Anda', [
      { text: '📸 Kamera', onPress: openCamera },
      { text: '🖼 Galeri', onPress: openGallery },
      { text: 'Batal', style: 'cancel' },
    ]);
  };
 
  /**
   * Alur permission KAMERA:
   * request permission -> cek granted -> akses kamera
   * -> cek canceled -> ambil assets[0].uri -> tampilkan Image
   */
  const openCamera = async () => {
    try {
      setLoadingPhoto(true);
 
      // 1. Request permission kamera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
 
      // 2. Cek apakah izin diberikan
      if (status !== 'granted') {
        showPermissionDeniedAlert('Kamera');
        return;
      }
 
      // 3. Akses kamera
      const hasil = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
 
      // 4. Cek apakah user membatalkan
      if (hasil.canceled) {
        return;
      }
 
      // 5. Ambil uri dari hasil dan tampilkan
      setPhotoUri(hasil.assets[0].uri);
    } catch (error) {
      Alert.alert('Terjadi Kesalahan', 'Tidak dapat mengakses kamera.');
      console.log('Error openCamera:', error);
    } finally {
      setLoadingPhoto(false);
    }
  };
 
  /**
   * Alur permission GALERI:
   * request permission -> cek granted -> akses galeri
   * -> cek canceled -> ambil assets[0].uri -> tampilkan Image
   */
  const openGallery = async () => {
    try {
      setLoadingPhoto(true);
 
      // 1. Request permission galeri
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
 
      // 2. Cek apakah izin diberikan
      if (status !== 'granted') {
        showPermissionDeniedAlert('Galeri');
        return;
      }
 
      // 3. Akses galeri
      const hasil = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
 
      // 4. Cek apakah user membatalkan
      if (hasil.canceled) {
        return;
      }
 
      // 5. Ambil uri dari hasil dan tampilkan
      setPhotoUri(hasil.assets[0].uri);
    } catch (error) {
      Alert.alert('Terjadi Kesalahan', 'Tidak dapat mengakses galeri.');
      console.log('Error openGallery:', error);
    } finally {
      setLoadingPhoto(false);
    }
  };
 
  // ------------------------------------------------------------------
  // FITUR: GPS + REVERSE GEOCODING + WEATHER
  // ------------------------------------------------------------------
 
  /**
   * Alur permission GPS:
   * request permission -> cek granted -> getCurrentPositionAsync
   * -> reverseGeocodeAsync -> tampilkan latitude, longitude, alamat
   * Setelah lokasi didapat, sekalian ambil data cuaca dari Open-Meteo.
   */
  const handleGetLocation = async () => {
    try {
      setLoadingLocation(true);
 
      // 1. Request permission lokasi
      const { status } = await Location.requestForegroundPermissionsAsync();
 
      // 2. Cek apakah izin diberikan
      if (status !== 'granted') {
        showPermissionDeniedAlert('Lokasi (GPS)');
        return;
      }
 
      // 3. Ambil posisi GPS saat ini
      const posisi = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = posisi.coords;
      setLocation({ latitude, longitude });
 
      // 4. Reverse geocoding -> ubah koordinat jadi alamat
      const hasilGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
 
      if (hasilGeocode.length > 0) {
        const alamat = hasilGeocode[0];
        setAddress(alamat);
      }
 
      // 5. Ambil data cuaca dari Open-Meteo berdasarkan koordinat
      await fetchWeather(latitude, longitude);
    } catch (error) {
      Alert.alert('Terjadi Kesalahan', 'Tidak dapat mengambil lokasi GPS.');
      console.log('Error handleGetLocation:', error);
    } finally {
      setLoadingLocation(false);
    }
  };
 
  /**
   * Mengambil data cuaca real-time dari Open-Meteo API
   * berdasarkan koordinat latitude & longitude user.
   */
  const fetchWeather = async (latitude, longitude) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const response = await fetch(url);
      const data = await response.json();
 
      if (data && data.current_weather) {
        const info = getWeatherInfo(data.current_weather.weathercode);
        setWeather({
          text: info.text,
          icon: info.icon,
          temp: Math.round(data.current_weather.temperature),
        });
      }
    } catch (error) {
      console.log('Error fetchWeather:', error);
    }
  };
 
  /**
   * Membuka Google Maps menggunakan koordinat yang tersimpan
   * melalui Linking (bekerja di Android & iOS).
   */
  const openInMaps = () => {
    if (!location) {
      Alert.alert('Lokasi Belum Ada', 'Silakan ambil lokasi terlebih dahulu.');
      return;
    }
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
    });
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
 
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(fallbackUrl);
        }
      })
      .catch(() => Linking.openURL(fallbackUrl));
  };
 
  // ------------------------------------------------------------------
  // FITUR: SIMPAN & RESET (AsyncStorage)
  // ------------------------------------------------------------------
 
  /**
   * Menyimpan foto, nama, latitude, longitude, dan nama tempat
   * ke AsyncStorage agar tetap ada saat aplikasi dibuka kembali.
   */
  const saveData = async () => {
    try {
      setSaving(true);
      const data = {
        photoUri,
        name,
        latitude: location ? location.latitude : null,
        longitude: location ? location.longitude : null,
        address,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      Alert.alert('Berhasil', 'Profil berhasil disimpan!');
    } catch (error) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan data.');
      console.log('Error saveData:', error);
    } finally {
      setSaving(false);
    }
  };
 
  /**
   * Menghapus seluruh data (foto, nama, lokasi) baik dari state
   * maupun dari AsyncStorage.
   */
  const resetData = () => {
    Alert.alert('Reset Data', 'Apakah Anda yakin ingin menghapus semua data?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setPhotoUri(null);
            setName('');
            setLocation(null);
            setAddress(null);
            setWeather(null);
          } catch (error) {
            console.log('Error resetData:', error);
          }
        },
      },
    ]);
  };
 
  // ------------------------------------------------------------------
  // HELPER: Menyusun teks alamat lengkap dari hasil reverseGeocodeAsync
  // ------------------------------------------------------------------
  const getFullAddress = () => {
    if (!address) return 'Alamat belum tersedia';
    const bagian = [
      address.name,
      address.street,
      address.city || address.subregion,
      address.region,
      address.country,
    ].filter(Boolean);
    return bagian.join(', ');
  };
 
  // ------------------------------------------------------------------
  // RENDER UI
  // ------------------------------------------------------------------
  return (
    <LinearGradient
      colors={['#D6ECFF', '#EEF6FF', '#FFFFFF']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>SnapJourney</Text>
          <Text style={styles.appSubtitle}>Capture Your Moment</Text>
        </View>
 
        {/* CARD PROFIL */}
        <View style={styles.card}>
          {/* AVATAR */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handleChangePhoto}
            activeOpacity={0.8}
          >
            {loadingPhoto ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : (
              <Image
                source={{ uri: photoUri || PLACEHOLDER_AVATAR }}
                style={styles.avatar}
              />
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>📸</Text>
            </View>
          </TouchableOpacity>
 
          {/* NAMA */}
          <TextInput
            style={styles.nameInput}
            placeholder="Masukkan nama Anda"
            placeholderTextColor="#A0AEC0"
            value={name}
            onChangeText={setName}
            textAlign="center"
          />
 
          {/* TANGGAL */}
          <Text style={styles.dateText}>{getFormattedDate()}</Text>
 
          {/* DIVIDER */}
          <View style={styles.divider} />
 
          {/* INFO LOKASI */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>📍 Lokasi</Text>
            <Text style={styles.infoValue}>{getFullAddress()}</Text>
          </View>
 
          {/* KOORDINAT */}
          <View style={styles.coordRow}>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordValue}>
                {location ? location.latitude.toFixed(6) : '-'}
              </Text>
            </View>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordValue}>
                {location ? location.longitude.toFixed(6) : '-'}
              </Text>
            </View>
          </View>
 
          {/* CUACA */}
          {weather && (
            <View style={styles.weatherBox}>
              <Text style={styles.weatherIcon}>{weather.icon}</Text>
              <View>
                <Text style={styles.weatherText}>{weather.text}</Text>
                <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              </View>
            </View>
          )}
 
          {loadingLocation && (
            <View style={styles.locationLoadingBox}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text style={styles.locationLoadingText}>Mengambil lokasi...</Text>
            </View>
          )}
        </View>
 
        {/* BUTTONS */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleChangePhoto}
          >
            <Text style={styles.buttonPrimaryText}>📸 Ubah Foto</Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleGetLocation}
          >
            <Text style={styles.buttonPrimaryText}>📍 Ambil Lokasi</Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={openInMaps}
          >
            <Text style={styles.buttonSecondaryText}>🗺 Lihat di Maps</Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.button, styles.buttonSuccess]}
            onPress={saveData}
            disabled={saving}
          >
            <Text style={styles.buttonPrimaryText}>
              {saving ? 'Menyimpan...' : '💾 Simpan'}
            </Text>
          </TouchableOpacity>
 
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={resetData}
          >
            <Text style={styles.buttonDangerText}>🗑 Reset</Text>
          </TouchableOpacity>
        </View>
 
        <Text style={styles.footerText}>SnapJourney © 2026</Text>
      </ScrollView>
    </LinearGradient>
  );
}
 
// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A365D',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#4A6785',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: '#EAF3FF',
  },
  avatarLoading: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#4A90E2',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarBadgeText: {
    fontSize: 14,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A365D',
    width: '100%',
    paddingVertical: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 12,
  },
  infoSection: {
    width: '100%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A6785',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3748',
    lineHeight: 20,
  },
  coordRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 12,
  },
  coordBox: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  coordLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A365D',
  },
  weatherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    gap: 12,
  },
  weatherIcon: {
    fontSize: 36,
  },
  weatherText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A365D',
  },
  weatherTemp: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4A90E2',
  },
  locationLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  locationLoadingText: {
    fontSize: 13,
    color: '#4A6785',
  },
  buttonGroup: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  buttonSecondaryText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSuccess: {
    backgroundColor: '#38A169',
    shadowColor: '#38A169',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDanger: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#FEB2B2',
  },
  buttonDangerText: {
    color: '#E53E3E',
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    marginTop: 24,
    fontSize: 12,
    color: '#A0AEC0',
  },
});