import Database from 'better-sqlite3';
import path from 'path';

export function getDbConnection() {
  // Caminho absoluto para o arquivo na raiz do projeto
  // process.cwd() pega a raiz onde o next roda
  const dbPath = path.join(process.cwd(), 'data', 'dados_clinica.db');

  try {
    // verbose: console.log ajuda a debugar queries se precisar
    const db = new Database(dbPath, { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined 
    });
    
    // Ativa o modo WAL (Crucial para ler enquanto os pythons escrevem)
    db.pragma('journal_mode = WAL');
    
    return db;
  } catch (error) {
    console.error("❌ Erro fatal ao conectar no SQLite:", error);
    console.error("   Caminho tentado:", dbPath);
    throw error;
  }
}