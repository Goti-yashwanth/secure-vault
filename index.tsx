import React, { useEffect, useState } from 'react';
import AuthForm from '../src/components/AuthForm';
import GeneratorOptions from '../src/components/GeneratorOptions';
import VaultEntry from '../src/components/VaultEntry';
import { encryptText, decryptText } from '../src/lib/crypto';
import { VaultItem, DecryptedItem } from '../src/lib/types';

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [encryptedItems, setEncryptedItems] = useState<VaultItem[]>([]);
  const [decryptedItems, setDecryptedItems] = useState<DecryptedItem[]>([]);
  const [genPass, setGenPass] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { if (userId) fetchItems(); }, [userId]);

  async function onAuth(id: string, masterPassword: string) {
    setUserId(id);
    setVaultKey(masterPassword);
  }

  async function fetchItems() {
    if (!userId) return;
    const r = await fetch(`/api/vault?userId=${userId}`);
    const j = await r.json();
    if (j.success) setEncryptedItems(j.items || []);
  }

  useEffect(() => {
    if (!vaultKey) return;
    (async () => {
      const dec: DecryptedItem[] = [];
      for (const it of encryptedItems) {
        const pw = await decryptText(it.encryptedPassword, it.ivPassword, vaultKey);
        const notes = await decryptText(it.encryptedNotes, it.ivNotes, vaultKey);
        dec.push({ id: it._id || '', title: it.title, username: it.username, url: it.url, password: pw, notes });
      }
      setDecryptedItems(dec);
    })();
  }, [encryptedItems, vaultKey]);

  async function saveItem(data: Omit<DecryptedItem, 'id'> & { id?: string }) {
    if (!vaultKey || !userId) return;
    const { ciphertext: cPass, iv: ivPass } = await encryptText(data.password, vaultKey);
    const { ciphertext: cNotes, iv: ivNotes } = await encryptText(data.notes || '', vaultKey);
    const payload: VaultItem = {
      _id: data.id,
      userId,
      title: data.title,
      username: data.username,
      url: data.url,
      encryptedPassword: cPass,
      encryptedNotes: cNotes,
      ivPassword: ivPass,
      ivNotes: ivNotes,
    };
    await fetch('/api/vault', { method: data.id ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    await fetchItems();
  }

  async function deleteItem(id: string) {
    if (!userId) return;
    await fetch(`/api/vault?id=${id}&userId=${userId}`, { method: 'DELETE' });
    await fetchItems();
  }

  const filtered = decryptedItems.filter(d => {
    const q = search.toLowerCase();
    return !q || d.title.toLowerCase().includes(q) || d.username.toLowerCase().includes(q) || d.url?.toLowerCase().includes(q) || d.notes.toLowerCase().includes(q);
  });

  if (!userId || !vaultKey) return <AuthForm onAuth={onAuth} />;

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Secure Vault 🛡️</h1>
        <button onClick={() => { setVaultKey(null); setUserId(null); setEncryptedItems([]); setDecryptedItems([]); }}>Logout</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 20 }}>
        <div>
          <GeneratorOptions onGenerate={setGenPass} />
          <div style={{ marginTop: 12 }}>
            <h4>Quick insert</h4>
            <form onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await saveItem({
                title: String(fd.get('title') || ''),
                username: String(fd.get('username') || ''),
                password: String(fd.get('password') || ''),
                notes: String(fd.get('notes') || ''),
                url: String(fd.get('url') || ''),
              });
              e.currentTarget.reset();
            }}>
              <input name="title" placeholder="Title" required />
              <input name="username" placeholder="Username" />
              <input name="password" placeholder="Password" defaultValue={genPass} />
              <input name="url" placeholder="URL" />
              <textarea name="notes" placeholder="Notes" />
              <button type="submit">Save</button>
            </form>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={fetchItems}>Refresh</button>
          </div>

          <h3 style={{ marginTop: 12 }}>Vault ({filtered.length})</h3>
          <div>
            {filtered.map(item => (
              <VaultEntry key={item.id} item={item}
                onEdit={async i => {
                  const title = prompt('Title', i.title) || i.title;
                  const username = prompt('Username', i.username) || i.username;
                  const password = prompt('Password', i.password) || i.password;
                  const url = prompt('URL', i.url || '') || i.url;
                  const notes = prompt('Notes', i.notes) || i.notes;
                  await saveItem({ id: i.id, title, username, password, notes, url });
                }}
                onDelete={async id => { if (confirm('Delete?')) await deleteItem(id); }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
