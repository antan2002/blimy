use anyhow::Result;
use rusqlite::{params, Connection};
use scraper::{Html, Selector};

#[derive(Debug, Clone)]
pub struct DocChunk {
   pub id: i64,
   pub url: String,
   pub title: String,
   pub content: String,
   pub score: f64,
}

pub fn init_db(path: &str) -> Result<Connection> {
   let conn = Connection::open(path)?;
   conn.execute(
      "CREATE TABLE IF NOT EXISTS docs (
            id INTEGER PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            content TEXT
        )",
      [],
   )?;
   Ok(conn)
}

pub fn crawl_and_index_docs(db_path: &str, start_url: &str) -> Result<usize> {
   let conn = init_db(db_path)?;
   let mut indexed = 0;
   index_url(&conn, start_url, &mut indexed, 0)?;
   Ok(indexed)
}

pub fn query_indexed_docs(db_path: &str, query: &str, limit: usize) -> Result<Vec<DocChunk>> {
   let conn = init_db(db_path)?;
   let mut stmt = conn.prepare(
      "SELECT id, url, title, content FROM docs WHERE content LIKE ? OR title LIKE ? LIMIT ?",
   )?;
   let pattern = format!("%{}%", query);
   let rows = stmt.query_map(params![pattern, pattern, limit as i64], |row| {
      Ok(DocChunk {
         id: row.get(0)?,
         url: row.get(1)?,
         title: row.get(2)?,
         content: row.get(3)?,
         score: 0.0,
      })
   })?;
   let mut chunks = Vec::new();
   for r in rows {
      chunks.push(r?);
   }
   Ok(chunks)
}

fn index_url(conn: &Connection, url: &str, indexed: &mut usize, depth: i32) -> Result<()> {
   if depth > 1 {
      return Ok(());
   }
   let resp = match reqwest::blocking::get(url) {
      Ok(r) => r,
      Err(_) => return Ok(()),
   };
   let text = match resp.text() {
      Ok(t) => t,
      Err(_) => return Ok(()),
   };
   let html = Html::parse_document(&text);
   let title_sel = Selector::parse("title").unwrap_or_else(|_| Selector::parse("h1").unwrap());
   let title = html
      .select(&title_sel)
      .next()
      .map(|e| e.text().collect::<String>().trim().to_string())
      .unwrap_or_default();
   let body = html.root_element().text().collect::<String>();
   let clean: String = body
      .split_whitespace()
      .take(8000)
      .collect::<Vec<_>>()
      .join(" ");
   let _ = conn.execute(
      "INSERT OR IGNORE INTO docs (url, title, content) VALUES (?, ?, ?)",
      params![url, title, clean],
   );
   *indexed += 1;
   // simple: do not recurse deeply for now
   Ok(())
}
