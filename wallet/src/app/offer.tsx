import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Body, Button, Card, Field, Input, Notice, Screen, Section, Title } from '../components/ui';
import { attributeLabel } from '../i18n/attributes';
import { configurationName, displayName, IssuanceError, PRE_AUTH_GRANT, acceptOffer, resolveOffer, type ResolvedOffer } from '../protocol/oid4vci';
import { useWallet } from '../state/wallet';

export default function Offer() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const w = useWallet();
  const [resolved, setResolved] = useState<ResolvedOffer | null>(null);
  const [error, setError] = useState('');
  const [txCode, setTxCode] = useState('');
  const [busy, setBusy] = useState(false);

  const explain = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'authorization_code_unsupported') return w.t('authCodeUnsupported');
    if (msg === 'deferred_unsupported') return w.t('deferredUnsupported');
    return msg;
  };

  useEffect(() => {
    resolveOffer(uri)
      .then(setResolved)
      .catch((e) => setError(explain(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  if (error) {
    return (
      <Screen>
        <Title>{w.t('error')}</Title>
        <Notice text={error} />
        <Button title={w.t('ok')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!resolved) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  const { offer, issuer } = resolved;
  const grant = offer.grants?.[PRE_AUTH_GRANT];
  const needsCode = Boolean(grant?.tx_code);
  const names = offer.credential_configuration_ids.map((id) =>
    configurationName(issuer.credential_configurations_supported[id], id, w.locale),
  );

  const accept = async () => {
    setBusy(true);
    try {
      const issued = await acceptOffer(resolved, { txCode: needsCode ? txCode.trim() : undefined, locale: w.locale }, fetch);
      await w.addCredentials(
        issued.map((i) => ({ ...i.credential, verification: i.verification })),
        {
          type: 'issuance',
          counterparty: { id: issuer.credential_issuer, name: displayName(issuer.display, w.locale) },
          credentialIds: issued.map((i) => i.credential.id),
          attributes: names,
          ok: true,
        },
      );
      router.replace('/');
    } catch (e) {
      setError(e instanceof IssuanceError || e instanceof Error ? explain(e) : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Field label={w.t('offerFrom')} value={`${displayName(issuer.display, w.locale) ?? ''}\n${issuer.credential_issuer}`.trim()} />
      </Card>
      <Section>{w.t('offerCredentials')}</Section>
      <Card>
        {names.map((n, i) => (
          <Body key={i}>{n}</Body>
        ))}
      </Card>
      {!grant ? <Notice text={w.t('authCodeUnsupported')} /> : null}
      {needsCode ? (
        <>
          <Section>{grant?.tx_code?.description ?? w.t('txCode')}</Section>
          <Input
            value={txCode}
            onChangeText={setTxCode}
            keyboardType={grant?.tx_code?.input_mode === 'text' ? 'default' : 'number-pad'}
            maxLength={grant?.tx_code?.length}
            autoCapitalize="none"
            accessibilityLabel={attributeLabel('code', w.locale)}
          />
        </>
      ) : null}
      <Button icon="download-outline" title={w.t('accept')} loading={busy} disabled={!grant || (needsCode && !txCode.trim())} onPress={accept} />
      <Button
        title={w.t('decline')}
        variant="secondary"
        disabled={busy}
        onPress={() => router.back()}
      />
    </Screen>
  );
}
