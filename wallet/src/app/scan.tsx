import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Body, Button, Input, Label, Screen } from '../components/ui';
import { classifyLink } from '../protocol/links';
import { useWallet } from '../state/wallet';

export default function Scan() {
  const w = useWallet();
  const [permission, requestPermission] = useCameraPermissions();
  const [pasted, setPasted] = useState('');
  const handled = useRef(false);

  const handle = (value: string) => {
    if (handled.current) return;
    const link = classifyLink(value);
    if (link.kind === 'unknown') {
      Alert.alert(w.t('error'), w.t('unknownLink'));
      return;
    }
    // OpenID4VCI / OpenID4VP flows land in the next update; until then say so honestly.
    Alert.alert(w.t('comingSoon'));
  };

  return (
    <Screen>
      <Body muted>{w.t('scanHint')}</Body>
      {permission?.granted ? (
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handle(data)}
          />
        </View>
      ) : (
        <>
          <Body>{w.t('cameraPermission')}</Body>
          <Button title={w.t('grantCamera')} onPress={requestPermission} />
        </>
      )}
      <Label>{w.t('pasteLink')}</Label>
      <Input
        value={pasted}
        onChangeText={setPasted}
        placeholder={w.t('pastePlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Button title={w.t('continue')} variant="secondary" disabled={!pasted.trim()} onPress={() => handle(pasted)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { height: 320, borderRadius: 16, overflow: 'hidden' },
});
