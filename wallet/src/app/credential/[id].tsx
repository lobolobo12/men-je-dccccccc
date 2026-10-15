import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { Banner, Button, Card, Label, Row, Screen, Title } from '../../components/ui';
import { attributeLabel } from '../../i18n/attributes';
import { claimName, credentialTitle, formatValue } from '../../lib/display';
import { useWallet } from '../../state/wallet';

export default function CredentialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useWallet();
  const cred = w.data?.credentials.find((c) => c.id === id);
  if (!cred) return null;
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(w.locale === 'sl' ? 'sl-SI' : 'en-GB') : '–');

  return (
    <Screen>
      <Title>{credentialTitle(cred, w.t)}</Title>
      {cred.demo ? <Banner text={w.t('demoNotice')} /> : null}
      {cred.verification ? (
        cred.verification.signatureValid && cred.verification.integrityValid ? (
          <Banner tone="ok" text={`${w.t('signatureOk')}${cred.verification.certificateSubject ? `\n${cred.verification.certificateSubject}` : ''}`} />
        ) : (
          <Banner text={w.t('signatureUnchecked')} />
        )
      ) : null}
      <Card>
        {cred.claims.map((c) => (
          <Row key={c.path.join('.')} label={attributeLabel(claimName(c), w.locale)} value={formatValue(c.value)} />
        ))}
      </Card>
      <Label>{w.t('details')}</Label>
      <Card>
        <Row label={w.t('issuer')} value={cred.issuer.name ? `${cred.issuer.name}\n${cred.issuer.id}` : cred.issuer.id} />
        <Row label={w.t('issued')} value={date(cred.issuedAt)} />
        <Row label={attributeLabel('expiry_date', w.locale)} value={date(cred.expiresAt)} />
        <Row label={w.t('format')} value={`${cred.format} · ${cred.type}`} />
      </Card>
      <Button
        variant="danger"
        title={w.t('deleteCredential')}
        onPress={() =>
          Alert.alert(w.t('deleteCredential'), w.t('deleteConfirm'), [
            { text: w.t('cancel'), style: 'cancel' },
            {
              text: w.t('delete'),
              style: 'destructive',
              onPress: async () => {
                await w.removeCredential(cred.id);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
