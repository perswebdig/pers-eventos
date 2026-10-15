-- =============================================================================
-- PersEventos — seed de desenvolvimento
-- 10 pessoas (1 menor) e 2 eventos com inscrições.
-- Roda após as migrations em `supabase db reset`.
-- =============================================================================

insert into public.pessoas
  (id, nome_completo, cpf, rg, data_nascimento, telefone, email, endereco,
   contato_emergencia_nome, contato_emergencia_telefone,
   restricoes_alimentares, condicoes_saude, medicacoes, observacoes,
   consentimento_lgpd)
values
  ('11111111-1111-1111-1111-000000000001', 'Ana Beatriz Souza',      '11111111111', 'MG-1',  '1988-03-12', '(31) 98888-0001', 'ana@exemplo.com',    'Rua das Flores, 10',      'Carlos Souza',  '(31) 98888-1001', 'Vegetariana',      null,                null,              'Participou do retiro de outono', true),
  ('11111111-1111-1111-1111-000000000002', 'Bruno Carvalho',        '22222222222', 'MG-2',  '1979-07-25', '(31) 98888-0002', 'bruno@exemplo.com',  'Av. Central, 200',        'Marina Carvalho','(31) 98888-1002', null,               'Hipertenso',        'Losartana 50mg',  null,                              true),
  ('11111111-1111-1111-1111-000000000003', 'Carla Menezes',         '33333333333', 'MG-3',  '1995-11-02', '(21) 97777-0003', 'carla@exemplo.com',  'Rua do Sol, 33',          'João Menezes',  '(21) 97777-1003', 'Sem glúten',       null,                null,              null,                              true),
  ('11111111-1111-1111-1111-000000000004', 'Diego Ferreira',        '44444444444', 'RJ-4',  '1990-01-18', '(21) 97777-0004', 'diego@exemplo.com',  'Rua da Praia, 44',        'Lúcia Ferreira','(21) 97777-1004', null,               null,                null,              'Alérgico a picada de abelha',     true),
  ('11111111-1111-1111-1111-000000000005', 'Elisa Rocha',           '55555555555', 'SP-5',  '1983-05-30', '(11) 96666-0005', 'elisa@exemplo.com',  'Al. Santos, 55',          'Paulo Rocha',   '(11) 96666-1005', 'Vegana',           null,                null,              null,                              true),
  ('11111111-1111-1111-1111-000000000006', 'Felipe Nunes',          '66666666666', 'SP-6',  '2007-09-14', '(11) 96666-0006', 'felipe@exemplo.com', 'Rua Nova, 66',            'Sônia Nunes',   '(11) 96666-1006', null,               null,                null,              'Menor de idade',                  true),
  ('11111111-1111-1111-1111-000000000007', 'Gabriela Lima',         '77777777777', 'BA-7',  '1992-12-21', '(71) 95555-0007', 'gabi@exemplo.com',   'Rua do Mar, 77',          'Rita Lima',     '(71) 95555-1007', null,               'Asma leve',         'Salbutamol',      null,                              true),
  ('11111111-1111-1111-1111-000000000008', 'Henrique Alves',        '88888888888', 'BA-8',  '1975-02-09', '(71) 95555-0008', 'henrique@exemplo.com','Rua Verde, 88',           'Clara Alves',   '(71) 95555-1008', 'Intolerante à lactose', null,          null,              null,                              true),
  ('11111111-1111-1111-1111-000000000009', 'Isabela Martins',       '99999999999', 'MG-9',  '1998-08-08', '(31) 98888-0009', 'isa@exemplo.com',    'Rua Azul, 99',            'Tereza Martins','(31) 98888-1009', null,               null,                null,              null,                              true),
  ('11111111-1111-1111-1111-000000000010', 'João Pedro Ramos',      '10101010101', 'MG-10', '1986-06-16', '(31) 98888-0010', 'joao@exemplo.com',   'Rua Ouro, 100',           'Marta Ramos',   '(31) 98888-1010', null,               null,                null,              null,                              true)
on conflict (id) do nothing;

-- Felipe Nunes é menor de idade → dados do responsável.
insert into public.menores
  (pessoa_id, responsavel_nome, responsavel_cpf, autorizacao_url)
values
  ('11111111-1111-1111-1111-000000000006', 'Sônia Nunes', '12121212121', null)
on conflict do nothing;

insert into public.eventos
  (id, nome, descricao, data_inicio, data_fim, local, capacidade, status)
values
  ('22222222-2222-2222-2222-000000000001', 'Retiro de Outono',
   'Fim de semana de meditação e trilhas na mata.',
   now() + interval '20 days', now() + interval '22 days',
   'Sítio Vale Verde', 30, 'planejado'),
  ('22222222-2222-2222-2222-000000000002', 'Vivência de Primavera',
   'Imersão de um dia com yoga, banho de floresta e círculo de partilha.',
   now() + interval '45 days', now() + interval '45 days',
   'Fazenda Serra Azul', 50, 'planejado')
on conflict (id) do nothing;

insert into public.inscricoes
  (pessoa_id, evento_id, status, pagamento_status, valor, forma_pagamento)
values
  ('11111111-1111-1111-1111-000000000001', '22222222-2222-2222-2222-000000000001', 'confirmado', 'pago',      480.00, 'pix'),
  ('11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000001', 'inscrito',   'pendente',  480.00, null),
  ('11111111-1111-1111-1111-000000000003', '22222222-2222-2222-2222-000000000001', 'confirmado', 'pago',      480.00, 'cartao'),
  ('11111111-1111-1111-1111-000000000005', '22222222-2222-2222-2222-000000000002', 'inscrito',   'pendente',  180.00, null),
  ('11111111-1111-1111-1111-000000000006', '22222222-2222-2222-2222-000000000002', 'inscrito',   'isento',      0.00, null),
  ('11111111-1111-1111-1111-000000000007', '22222222-2222-2222-2222-000000000002', 'checkin',    'pago',      180.00, 'dinheiro')
on conflict (evento_id, pessoa_id) do nothing;
