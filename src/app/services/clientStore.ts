// src/app/services/clientStore.ts
import localforage from "localforage";

const clientStore = localforage.createInstance({
  name: "solarinvest-app",
  storeName: "clients",
});

type ClientPayload = {
  version: 1;
  savedAt: string;
  dados: any; // ClienteDados
};

const keyOf = (id: string) => `client:${id}`;

export async function saveClientById(id: string, dados: any) {
  const payload: ClientPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    dados: structuredClone(dados),
  };

  await clientStore.setItem(keyOf(id), payload);

  const verify = await clientStore.getItem<ClientPayload>(keyOf(id));
  console.log("[clientStore] SAVED+VERIFIED", id, {
    hasPayload: !!verify,
    endereco: verify?.dados?.endereco ?? "",
    nome: verify?.dados?.nome ?? "",
    savedAt: verify?.savedAt,
  });
}

export async function loadClientById(id: string) {
  const payload = await clientStore.getItem<ClientPayload>(keyOf(id));
  if (!payload) return null;

  console.log("[clientStore] LOADED", id, {
    endereco: payload?.dados?.endereco ?? "",
    nome: payload?.dados?.nome ?? "",
    savedAt: payload?.savedAt,
  });

  return payload.dados ?? null;
}
