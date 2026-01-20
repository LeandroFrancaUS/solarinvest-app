// src/app/services/clientStore.ts
import localforage from "localforage";

// Ajuste se seu projeto usa outro export/type path
// Se tiver os types em outro arquivo, troque o import.
export type ClienteDados = any; // troque por: import type { ClienteDados } from "../types/..."
export type OrcamentoSnapshotData = any; // troque por seu type real

export type ClienteRegistro = {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  dados: ClienteDados;
  propostaSnapshot?: OrcamentoSnapshotData;
};

const db = localforage.createInstance({
  name: "solarinvest-app",
  storeName: "clients",
});

type StoredRegistroPayload = {
  version: 1;
  savedAt: string;
  registro: ClienteRegistro;
};

type IndexPayload = {
  version: 1;
  savedAt: string;
  ids: string[];
};

const KEY_INDEX = "clients:index";
const keyOf = (id: string) => `client:${id}`;

const clone = <T,>(value: T): T => {
  // structuredClone funciona nos browsers modernos; fallback via JSON
  try {
    // @ts-ignore
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

async function readIndex(): Promise<IndexPayload> {
  const index = await db.getItem<IndexPayload>(KEY_INDEX);
  if (index?.version === 1 && Array.isArray(index.ids)) return index;
  return { version: 1, savedAt: new Date().toISOString(), ids: [] };
}

async function writeIndex(ids: string[]) {
  const payload: IndexPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    ids,
  };
  await db.setItem(KEY_INDEX, payload);
}

export async function upsertClienteRegistro(registro: ClienteRegistro) {
  const id = registro.id;
  const payload: StoredRegistroPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    registro: clone(registro),
  };

  await db.setItem(keyOf(id), payload);

  // Atualiza índice (garante que o ID existe e fica “recente primeiro”)
  const index = await readIndex();
  const idsSemId = index.ids.filter((x) => x !== id);
  const idsAtualizados = [id, ...idsSemId];
  await writeIndex(idsAtualizados);

  // verificação
  const verify = await db.getItem<StoredRegistroPayload>(keyOf(id));
  console.log("[clientStore] UPSERT SAVED+VERIFIED", id, {
    hasPayload: !!verify,
    nome: verify?.registro?.dados?.nome ?? "",
    endereco: verify?.registro?.dados?.endereco ?? "",
    atualizadoEm: verify?.registro?.atualizadoEm,
    savedAt: verify?.savedAt,
    indexSize: idsAtualizados.length,
  });

  return verify?.registro ?? registro;
}

export async function getClienteRegistroById(id: string): Promise<ClienteRegistro | null> {
  const payload = await db.getItem<StoredRegistroPayload>(keyOf(id));
  if (!payload?.registro) return null;

  console.log("[clientStore] GET BY ID", id, {
    nome: payload.registro?.dados?.nome ?? "",
    endereco: payload.registro?.dados?.endereco ?? "",
    atualizadoEm: payload.registro?.atualizadoEm,
    savedAt: payload.savedAt,
  });

  return payload.registro;
}

// Lista para o painel “Ver clientes”
export async function getAllClienteRegistros(): Promise<ClienteRegistro[]> {
  const index = await readIndex();
  const ids = index.ids;

  if (ids.length === 0) return [];

  const items = await Promise.all(
    ids.map(async (id) => {
      const payload = await db.getItem<StoredRegistroPayload>(keyOf(id));
      return payload?.registro ?? null;
    })
  );

  // remove nulos (ids órfãos)
  const registros = items.filter(Boolean) as ClienteRegistro[];

  // se tiver órfãos, reescreve índice limpo
  if (registros.length !== ids.length) {
    const idsOk = registros.map((r) => r.id);
    await writeIndex(idsOk);
  }

  // Ordena por atualizadoEm desc (garantia extra)
  registros.sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""));

  console.log("[clientStore] GET ALL", {
    total: registros.length,
    top: registros[0]?.id,
    topUpdatedAt: registros[0]?.atualizadoEm,
  });

  return registros;
}

export async function deleteClienteById(id: string) {
  await db.removeItem(keyOf(id));

  const index = await readIndex();
  const idsAtualizados = index.ids.filter((x) => x !== id);
  await writeIndex(idsAtualizados);

  console.log("[clientStore] DELETED", id, { indexSize: idsAtualizados.length });
}

// Útil pra “nova proposta” NÃO mexer com clientes: não chame isso lá.
// Só use manualmente se precisar resetar a base de clientes.
export async function clearAllClientes() {
  const index = await readIndex();
  await Promise.all(index.ids.map((id) => db.removeItem(keyOf(id))));
  await writeIndex([]);
  console.log("[clientStore] CLEARED ALL CLIENTS");
}
