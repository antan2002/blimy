use tauri::{AppHandle, command};

#[command]
pub async fn crawl_and_index_docs(_app: AppHandle, url: String) -> Result<usize, String> {
   let db_path = dirs::data_dir()
      .unwrap_or_else(|| std::env::temp_dir())
      .join("blimy")
      .join("docs_index.db")
      .to_string_lossy()
      .to_string();
   blimy_docs_indexer::crawl_and_index_docs(&db_path, &url).map_err(|e| e.to_string())
}

#[command]
pub async fn query_indexed_docs(
   _app: AppHandle,
   query: String,
   limit: Option<usize>,
) -> Result<Vec<serde_json::Value>, String> {
   let db_path = dirs::data_dir()
      .unwrap_or_else(|| std::env::temp_dir())
      .join("blimy")
      .join("docs_index.db")
      .to_string_lossy()
      .to_string();
   let limit = limit.unwrap_or(10);
   let results =
      blimy_docs_indexer::query_indexed_docs(&db_path, &query, limit).map_err(|e| e.to_string())?;
   Ok(results
      .into_iter()
      .map(|r| {
         serde_json::json!({
             "id": r.id,
             "url": r.url,
             "title": r.title,
             "content": r.content,
             "score": r.score,
         })
      })
      .collect())
}
