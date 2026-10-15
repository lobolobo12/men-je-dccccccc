import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { KIND_ICON } from '../../components/CredentialCard';
import { Hero } from '../../components/Hero';
import { kindGradients } from '../../components/theme';
import { Button, Card, Field, Notice, Screen, Section } from '../../components/ui';
import { attributeLabel } from '../../i18n/attributes';
import { claimName, claimValue, credentialTitle, formatValue, sortClaims } from '../../lib/display';
import { useWallet } from '../../state/wallet';

export default function CredentialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = useWallet();
  const cred = w.data?.credentials.find((c) => c.id === id);
  if (!cred) return null;
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(w.locale === 'sl' ? 'sl-SI' : 'en-GB') : '–');
  const v = cred.verification;
  const claims = sortClaims(cred.claims);
  const holder = [claimValue(cred, 'given_name'), claimValue(cred, 'family_name')].filter(Boolean).join(' ');

  return (
    <Screen
      header={
        <Hero
          colors={kindGradients[cred.kind]}
          icon={KIND_ICON[cred.kind]}
          title={holder || credentialTitle(cred, w.t)}
          subtitle={`${credentialTitle(cred, w.t)}\n${cred.expiresAt ? w.t('expires', { date: date(cred.expiresAt) }) : ''}`.trim()}
        />
      }
    >
      {cred.demo ? <Notice text={w.t('demoNotice')} icon="flask-outline" /> : null}
      {v ? (
        v.signatureValid && v.integrityValid ? (
          <Notice tone="ok" text={`${w.t('signatureOk')}${v.certificateSubject ? `\n${v.certificateSubject}` : ''}`} />
        ) : (
          <Notice text={w.t('signatureUnchecked')} />
        )
      ) : null}

      <Section>{w.t('details')}</Section>
      <Card>
        {claims.map((c, i) => (
          <Field
            key={c.path.join('.')}
            label={attributeLabel(claimName(c), w.locale)}
            value={formatValue(c.value, w.locale)}
            last={i === claims.length - 1}
          />
        ))}
      </Card>

      <Section>{w.t('issuer')}</Section>
      <Card>
        <Field label={w.t('issuer')} value={cred.issuer.name ? `${cred.issuer.name}\n${cred.issuer.id}` : cred.issuer.id} />
        <Field label={w.t('issued')} value={date(cred.issuedAt)} />
        <Field label={attributeLabel('expiry_date', w.locale)} value={date(cred.expiresAt)} />
        <Field label={w.t('format')} value={`${cred.format}\n${cred.type}`} last />
      </Card>

      <Button
        variant="danger"
        icon="trash-outline"
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
