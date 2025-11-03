-- db/migrations/0002_create_clients.down.sql
-- Rollback: remove tabela clients (atenção: perda de dados)
DROP TABLE IF EXISTS clients;