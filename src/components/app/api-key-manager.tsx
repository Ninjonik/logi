"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiKey = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };

export function ApiKeyManager({ serverId }: { serverId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const url = `/api/servers/${serverId}/api-keys`;
  const load = async () => { const response = await fetch(url); if (response.ok) setKeys((await response.json()).keys); };
  useEffect(() => { void load(); }, [serverId]);
  async function create() { setPending(true); try { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setNewKey(body.key); setName(""); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create API key."); } finally { setPending(false); } }
  async function revoke(keyId: string) { const response = await fetch(`${url}?keyId=${encodeURIComponent(keyId)}`, { method: "DELETE" }); if (!response.ok) { toast.error("Unable to revoke API key."); return; } await load(); }
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Create a key for your clan website. A key can read your clan’s website data and is shown only once.</p>{newKey ? <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"><p className="mb-2 text-sm font-medium">Copy this key now. It cannot be shown again.</p><div className="flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded bg-background p-2 text-xs">{newKey}</code><Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(newKey).then(() => toast.success("API key copied."))}><Copy className="size-4" /><span className="sr-only">Copy API key</span></Button></div></div> : null}<div className="flex flex-wrap gap-2"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Website name, e.g. main site" maxLength={80} className="max-w-sm" /><Button onClick={create} disabled={pending || !name.trim()}><Plus className="size-4" />Create key</Button></div><div className="space-y-2">{keys.map(key => <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{key.name}</p><p className="text-xs text-muted-foreground">{key.keyPrefix}… · created {new Date(key.createdAt).toLocaleDateString()}{key.revokedAt ? " · revoked" : ""}</p></div>{!key.revokedAt ? <Button size="sm" variant="outline" onClick={() => revoke(key.id)}><Trash2 className="size-4" />Revoke</Button> : null}</div>)}</div></div>;
}
