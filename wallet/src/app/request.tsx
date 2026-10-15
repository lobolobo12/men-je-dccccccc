import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { fonts, useTheme } from '../components/theme';
import { Button, Card, Field, Notice, Screen, Section, Title } from '../components/ui';
import { attributeLabel } from '../i18n/attributes';
import { claimName, credentialTitle, formatValue } from '../lib/display';
import type { StoredCredential } from '../lib/types';
import {
  declinePresentation,
  matchCredentials,
  requestedPaths,
  resolveRequest,
  submitPresentation,
  type CredentialQuery,
  type ResolvedRequest,
} from '../protocol/oid4vp';
import { useWallet } from '../state/wallet';

type Choice = { query: CredentialQuery; credential: StoredCredential; items: { path: string[]; optional: boolean; on: boolean }[] };

export default function Request() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const w = useWallet();
  const t = useTheme();
  const [resolved, setResolved] = useState<ResolvedRequest | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    resolveRequest(uri)
      .then((r) => {
        const creds = w.data?.credentials ?? [];
        const out: Choice[] = [];
        let lacking = false;
        for (const q of r.queries) {
          const [credential] = matchCredentials(q, creds);
          if (!credential) {
            if (!q.optional) lacking = true;
            continue;
          }
          out.push({ query: q, credential, items: requestedPaths(q, credential).map((p) => ({ ...p, on: true })) });
        }
        setResolved(r);
        setChoices(out);
        setMissing(lacking);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const sharedNames = useMemo(
    () => choices.flatMap((c) => c.items.filter((i) => i.on).map((i) => attributeLabel(i.path[i.path.length - 1], w.locale))),
    [choices, w.locale],
  );

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

  const { verifier } = resolved;
  const domain = verifier.clientId.split(':').slice(1).join(':') || verifier.clientId;
  const log = (type: 'presentation' | 'presentation_declined', ok: boolean, detail?: string) =>
    w.addLog({
      type,
      counterparty: { id: verifier.clientId, name: verifier.name },
      credentialIds: choices.map((c) => c.credential.id),
      attributes: type === 'presentation' ? sharedNames : [],
      ok,
      detail,
    });

  const share = async () => {
    setBusy(true);
    try {
      const selections = choices.map((c) => ({ query: c.query, credential: c.credential, paths: c.items.filter((i) => i.on).map((i) => i.path) }));
      const { redirectUri } = await submitPresentation(resolved, selections);
      await log('presentation', true);
      router.replace('/');
      if (redirectUri) Linking.openURL(redirectUri).catch(() => undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await log('presentation', false, msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    await declinePresentation(resolved);
    await log('presentation_declined', true);
    router.back();
  };

  const toggle = (ci: number, ii: number) =>
    setChoices((prev) => prev.map((c, i) => (i !== ci ? c : { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, on: !it.on } : it)) })));

  return (
    <Screen>
      <Card>
        <Field label={w.t('requestFrom')} value={`${verifier.name}\n${verifier.clientId}`} />
      </Card>
      {verifier.authenticated ? (
        <Notice tone="ok" text={`${w.t('verifiedVerifier', { domain })}\n${w.t('trustNote')}`} />
      ) : (
        <Notice text={w.t('unverifiedVerifier')} />
      )}
      {missing ? <Notice text={w.t('missingCredential')} /> : null}

      {choices.map((c, ci) => (
        <View key={c.query.id} style={styles.block}>
          <Section>
            {w.t('credentialUsed')}: {credentialTitle(c.credential, w.t)}
          </Section>
          <Card>
            {c.items.map((it, ii) => {
              const claim = c.credential.claims.find((cl) => it.path.every((s, k) => cl.path[k] === s));
              return (
                <Pressable key={it.path.join('.')} disabled={!it.optional} onPress={() => toggle(ci, ii)} style={styles.item}>
                  <View style={styles.flex}>
                    <Text style={{ color: t.text, fontSize: 16, fontFamily: fonts.medium }}>
                      {attributeLabel(claim ? claimName(claim) : it.path[it.path.length - 1], w.locale)}
                      {it.optional ? <Text style={{ color: t.muted, fontFamily: fonts.regular }}> ({w.t('optional')})</Text> : null}
                    </Text>
                    <Text style={{ color: t.muted, fontFamily: fonts.regular, marginTop: 2 }}>{claim ? formatValue(claim.value, w.locale) : '–'}</Text>
                  </View>
                  {it.optional ? <Switch value={it.on} onValueChange={() => toggle(ci, ii)} /> : null}
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}

      <Button icon="share-outline" title={w.t('shareSelected')} loading={busy} disabled={missing || choices.length === 0} onPress={share} />
      <Button title={w.t('decline')} variant="secondary" disabled={busy} onPress={decline} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  flex: { flex: 1 },
});
