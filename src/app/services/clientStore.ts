// src/app/services/clientStore.ts
import localforage from "localforage";

export type ClienteRegistro = {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  dados: any; // ClienteDados
  propostaSnapshot?: any; // OrcamentoSnapshotData
};

type Payload = {
  version: 1;
  savedAt: string;
  registro: ClienteRegistro;
};

const store = localforage.createInstance({
  name: "solarinvest-app",
  storeName: "clients",
});

const keyOf = (id: string) => `client:${id}`;

export async function upsertClienteRegistro(registro: ClienteRegistro) {
  const payload: Payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    registro: structuredClone(registro),
  };

  await store.setItem(keyOf(registro.id), payload);

  const verify = await store.getItem<Payload>(keyOf(registro.id));
  console.log("[clientStore] UPSERT+VERIFIED", registro.id, {
    hasPayload: !!verify,
    endereco: verify?.registro?.dados?.endereco ?? "",
    nome: verify?.registro?.dados?.nome ?? "",
    updatedAt: verify?.registro?.atualizadoEm,
    savedAt: verify?.savedAt,
  });
}

export async function getClienteRegistroById(id: string) {
  const payload = await store.getItem<Payload>(keyOf(id));
  if (!payload?.registro) return null;

  console.log("[clientStore] LOADED", id, {
    endereco: payload.registro.dados?.endereco ?? "",
    nome: payload.registro.dados?.nome ?? "",
    updatedAt: payload.registro.atualizadoEm,
    savedAt: payload.savedAt,
  });

  return payload.registro;
}

export async function getAllClienteRegistros(): Promise<ClienteRegistro[]> {
  const registros: ClienteRegistro[] = [];
  await store.iterate<Payload, void>((value, key) => {
    if (key.startsWith("client:") && value?.registro) {
      registros.push(value.registro);
    }
  });

  // mais recentes primeiro
  registros.sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""));
  return registros;
}

export async function deleteClienteById(id: string) {
  await store.removeItem(keyOf(id));
  console.log("[clientStore] DELETED", id);
}
