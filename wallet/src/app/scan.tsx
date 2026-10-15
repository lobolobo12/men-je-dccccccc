import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Hero } from '../components/Hero';
import { heroColors } from '../components/theme';
import { Body, Button, Card, Input, ListRow, Screen, Section } from '../components/ui';
import { startDemoRequest } from '../protocol/demoVerifier';
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
    handled.current = true;
    router.replace({ pathname: link.kind === 'offer' ? '/offer' : '/request', params: { uri: link.uri } });
  };

  return (
    <Screen header={<Hero colors={heroColors.scan} icon="scan-outline" title={w.t('scanTitle')} subtitle={w.t('scanHint')} />}>
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
        <Card>
          <Body>{w.t('cameraPermission')}</Body>
          <View style={{ height: 12 }} />
          <Button icon="camera-outline" title={w.t('grantCamera')} onPress={requestPermission} />
        </Card>
      )}
      <Section>{w.t('tryWithoutQr')}</Section>
      <Card padded={false}>
        <ListRow icon="wine-outline" title={w.t('demoAge')} subtitle={w.t('demoAgeSub')} onPress={() => handle(startDemoRequest('age', w.locale))} />
        <ListRow icon="car-sport-outline" title={w.t('demoCar')} subtitle={w.t('demoCarSub')} onPress={() => handle(startDemoRequest('car', w.locale))} />
        <ListRow
          icon="business-outline"
          title={w.t('demoBank')}
          subtitle={w.t('demoBankSub')}
          onPress={() => handle(startDemoRequest('bank', w.locale))}
          last
        />
      </Card>
      <Section>{w.t('pasteLink')}</Section>
      <Input
        value={pasted}
        onChangeText={setPasted}
        placeholder={w.t('pastePlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Button icon="link-outline" title={w.t('continue')} variant="secondary" disabled={!pasted.trim()} onPress={() => handle(pasted)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { aspectRatio: 1, borderRadius: 24, overflow: 'hidden' },
});
