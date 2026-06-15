-- Migration: Sri Distribution System
-- Date: 2026-06-13
-- Purpose: Create tables for centralized SRI invoice download coordination

-- 1. Batch mensual (1 por mes)
CREATE TABLE IF NOT EXISTS sri_distribution_batch (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_month DATE NOT NULL,
  total_clients INT,
  total_invoices INT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, error
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(batch_month)
);

-- 2. Tarea asignada a cada máquina (5 filas por batch)
CREATE TABLE IF NOT EXISTS sri_machine_task (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id INT NOT NULL, -- 1-5
  assigned_clients JSONB, -- [{ client_id: 1, name: "Cliente A", ruc: "1234567890001" }, ...]
  total_invoices INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, error
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  UNIQUE(batch_id, machine_id)
);

-- 3. Por cada cliente en descarga (50 filas por batch)
CREATE TABLE IF NOT EXISTS sri_client_download (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id INT NOT NULL,
  client_id INT NOT NULL,
  client_name VARCHAR(255),
  client_ruc VARCHAR(13),
  total_invoices INT DEFAULT 300,
  downloaded INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT,
  error_count INT DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_reported_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(batch_id, client_id)
);

-- 4. Log de cada XML descargado (hasta 15,000 por batch)
CREATE TABLE IF NOT EXISTS sri_xml_downloaded (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id INT NOT NULL,
  client_id INT NOT NULL,
  invoice_id VARCHAR(50),
  xml_hash VARCHAR(64), -- SHA256 para deduplicación
  file_size INT,
  status VARCHAR(20) DEFAULT 'downloaded', -- downloaded, processing, imported, error
  imported BOOLEAN DEFAULT FALSE,
  purchase_order_id BIGINT REFERENCES purchase_order(id) ON DELETE SET NULL,
  error_message TEXT,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  imported_at TIMESTAMP,
  INDEX idx_batch_client (batch_id, client_id),
  INDEX idx_hash (xml_hash),
  UNIQUE(batch_id, xml_hash)
);

-- 5. Errores y reintentos
CREATE TABLE IF NOT EXISTS sri_download_error_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES sri_distribution_batch(id) ON DELETE CASCADE,
  machine_id INT NOT NULL,
  client_download_id BIGINT REFERENCES sri_client_download(id) ON DELETE SET NULL,
  error_type VARCHAR(50), -- 'captcha', 'timeout', 'auth_failed', 'network', 'xml_invalid', etc
  error_message TEXT,
  attempt_number INT DEFAULT 1,
  retry_scheduled_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_batch_client (batch_id, client_download_id)
);

-- Indices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_batch_status ON sri_distribution_batch(status);
CREATE INDEX IF NOT EXISTS idx_machine_task_status ON sri_machine_task(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_client_download_status ON sri_client_download(batch_id, machine_id, status);

-- RLS (Row Level Security) - Básicamente, todos los usuarios pueden leer (dentro de su empresa)
-- pero solo admin puede crear batches
ALTER TABLE sri_distribution_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE sri_machine_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE sri_client_download ENABLE ROW LEVEL SECURITY;
ALTER TABLE sri_xml_downloaded ENABLE ROW LEVEL SECURITY;
ALTER TABLE sri_download_error_log ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer
CREATE POLICY "Anyone can read distribution batches"
  ON sri_distribution_batch FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read machine tasks"
  ON sri_machine_task FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read client downloads"
  ON sri_client_download FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read downloaded XMLs"
  ON sri_xml_downloaded FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read error logs"
  ON sri_download_error_log FOR SELECT
  USING (true);

-- Policy: Solo el creator puede insertar/actualizar batches
CREATE POLICY "Users can create batches"
  ON sri_distribution_batch FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Policy: Máquinas pueden actualizar sus tareas (via API con secret key)
CREATE POLICY "Machines can update tasks"
  ON sri_machine_task FOR UPDATE
  USING (true);

CREATE POLICY "Machines can update client downloads"
  ON sri_client_download FOR UPDATE
  USING (true);

CREATE POLICY "Machines can insert downloaded XMLs"
  ON sri_xml_downloaded FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Machines can insert error logs"
  ON sri_download_error_log FOR INSERT
  WITH CHECK (true);

COMMIT;
