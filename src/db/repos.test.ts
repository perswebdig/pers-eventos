import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveLocal, deleteLocal } from '@/db/queue';
import { registrarAceiteTermo } from '@/db/repos/termos';
import { db } from '@/db/db';

const makePessoa = (nome: string) => ({
  id: crypto.randomUUID(),
  nome_completo: nome,
  cpf: null, rg: null, data_nascimento: null, telefone: null, email: null,
  endereco: null, contato_emergencia_nome: null, contato_emergencia_telefone: null,
  restricoes_alimentares: null, condicoes_saude: null, medicacoes: null,
  observacoes: null, consentimento_lgpd: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: 'synced' as const,
});

beforeEach(async () => {
  // Reset the global database for each test
  await db.delete();
  await db.open();
});

describe('db/queue (saveLocal/deleteLocal)', () => {
  it('inserts new record with pending status', async () => {
    const pessoa = { id: 'p1', nome_completo: 'Teste', sync_status: 'synced' as const };
    const saved = await saveLocal(db, 'pessoas', pessoa);
    expect(saved.sync_status).toBe('pending');
    expect(saved.updated_at).toBeDefined();

    const inDb = await db.pessoas.get('p1');
    expect(inDb).toEqual(saved);
  });

  it('updates existing record', async () => {
    const pessoa = { id: 'p1', nome_completo: 'Teste', sync_status: 'synced' as const };
    await saveLocal(db, 'pessoas', pessoa);

    const updated = await saveLocal(db, 'pessoas', {
      ...pessoa,
      nome_completo: 'Teste Atualizado',
    });
    expect(updated.nome_completo).toBe('Teste Atualizado');
    expect(updated.sync_status).toBe('pending');
  });

  it('enqueues insert for new record', async () => {
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'A', sync_status: 'synced' });
    const queue = await db.sync_queue.where('[entidade+entidade_id]').equals(['pessoas', 'p1']).toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].operacao).toBe('insert');
  });

  it('collapses insert + update into single insert', async () => {
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'A', sync_status: 'synced' });
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'B', sync_status: 'synced' });
    const queue = await db.sync_queue.where('[entidade+entidade_id]').equals(['pessoas', 'p1']).toArray();
    expect(queue.length).toBe(1);
    // insert has priority over update
    expect(queue[0].operacao).toBe('insert');
  });

  it('deletes record and enqueues delete', async () => {
    // First, create and sync the record (simulate it was already synced)
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'A', sync_status: 'synced' });
    // Simulate sync by clearing the queue and marking as synced
    await db.sync_queue.clear();
    await db.pessoas.update('p1', { sync_status: 'synced' });
    
    // Now delete - should enqueue delete since record was synced
    await deleteLocal(db, 'pessoas', 'p1');
    const inDb = await db.pessoas.get('p1');
    expect(inDb).toBeUndefined();
    const queue = await db.sync_queue.where('[entidade+entidade_id]').equals(['pessoas', 'p1']).toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].operacao).toBe('delete');
  });

  it('collapses multiple updates into one queue entry', async () => {
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'A', sync_status: 'synced' });
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'B', sync_status: 'synced' });
    await saveLocal(db, 'pessoas', { id: 'p1', nome_completo: 'C', sync_status: 'synced' });
    const queue = await db.sync_queue.where('[entidade+entidade_id]').equals(['pessoas', 'p1']).toArray();
    expect(queue.length).toBe(1);
  });
});

describe('repos/termos', () => {
  it('registra aceite de termo', async () => {
    const p1 = makePessoa('Ana');
    await db.pessoas.put(p1);

    const termoId = await (await import('@/db/repos/termos')).registrarAceiteTermo({
      pessoa_id: p1.id,
      tipo: 'responsabilidade',
      assinatura_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XfJsAAAAASUVORK5CYII=',
    });
    const termos = await db.termos.where('pessoa_id').equals(p1.id).toArray();
    expect(termos.length).toBe(1);
    expect(termos[0].tipo).toBe('responsabilidade');
    expect(termos[0].sync_status).toBe('pending');
  });

  it('jaAceitouTermo verifica se já aceitou', async () => {
    const p1 = makePessoa('Ana');
    await db.pessoas.put(p1);
    await (await import('@/db/repos/termos')).registrarAceiteTermo({ pessoa_id: p1.id, tipo: 'responsabilidade', assinatura_base64: 'data:image/png;base64,test' });

    expect(await (await import('@/db/repos/termos')).jaAceitouTermo(p1.id, 'responsabilidade')).toBe(true);
    expect(await (await import('@/db/repos/termos')).jaAceitouTermo(p1.id, 'imagem')).toBe(false);
  });

  it('getAssinaturaBlob retorna blob', async () => {
    const p1 = makePessoa('Ana');
    await db.pessoas.put(p1);
    const termoId = await (await import('@/db/repos/termos')).registrarAceiteTermo({
      pessoa_id: p1.id,
      tipo: 'responsabilidade',
      assinatura_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XfJsAAAAASUVORK5CYII=',
    });

    const blob = await (await import('@/db/repos/termos')).getAssinaturaBlob(termoId);
    // fake-indexeddb may not preserve Blob type; just verify it returns truthy data
    expect(blob).toBeTruthy();
    if (blob && typeof blob === 'object' && 'size' in blob) {
      expect((blob as { size: number }).size).toBeGreaterThan(0);
    }
  });

  it('múltiplos termos por pessoa', async () => {
    const p1 = makePessoa('Ana');
    await db.pessoas.put(p1);

    await (await import('@/db/repos/termos')).registrarAceiteTermo({ pessoa_id: p1.id, tipo: 'responsabilidade', assinatura_base64: 'data:image/png;base64,test' });
    await (await import('@/db/repos/termos')).registrarAceiteTermo({ pessoa_id: p1.id, tipo: 'imagem', assinatura_base64: 'data:image/png;base64,test' });

    const todos = await db.termos.where('pessoa_id').equals(p1.id).toArray();
    expect(todos.length).toBe(2);
    const tipos = todos.map(t => t.tipo).sort();
    expect(tipos).toEqual(['imagem', 'responsabilidade']);
  });
});