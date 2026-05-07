use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::sync::OnceLock;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static API_BASE: OnceLock<String> = OnceLock::new();
static CORE_API_BASE: OnceLock<String> = OnceLock::new();
static API_KEY_VAL: OnceLock<String> = OnceLock::new();

fn client() -> &'static Client {
    HTTP_CLIENT.get_or_init(Client::new)
}

fn api_base() -> &'static str {
    API_BASE.get_or_init(|| std::env::var("API_BASE_URL").unwrap_or_else(|_| "http://localhost/api/library".to_string()))
}

fn core_api_base() -> &'static str {
    CORE_API_BASE.get_or_init(|| std::env::var("CORE_API_BASE_URL").unwrap_or_else(|_| "http://localhost/api/core".to_string()))
}

fn api_key() -> &'static str {
    API_KEY_VAL.get_or_init(|| std::env::var("API_KEY").unwrap_or_default())
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: i64,
    pub barcode: String,
    pub title: String,
    pub authors: Vec<String>,
    pub thumbnail_link: String,
    pub genre: Genre,
    pub stock: Stock,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Stock {
    pub total: i64,
    pub loaned_count: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Genre {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Loan {
    pub id: i64,
    pub book: BookRef,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "borrowedAt")]
    pub borrowed_at: String,
    #[serde(rename = "dueAt")]
    pub due_at: Option<String>,
    #[serde(rename = "returnedAt")]
    pub returned_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct BookRef {
    pub id: i64,
    pub title: String,
    pub barcode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BorrowRequest {
    qr_id: String,
    barcode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    loan_period_days: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReturnRequest {
    qr_id: String,
    barcode: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub id: String,
}

#[tauri::command]
async fn verify_user(qr_id: String) -> Result<UserInfo, String> {
    let url = format!("{}/internal/users/qid/{}", core_api_base(), qr_id);
    let res = client()
        .get(&url)
        .header("X-API-Key", api_key())
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"].as_str().map(String::from))
            .unwrap_or_else(|| "ユーザーが見つかりません".to_string());
        return Err(msg);
    }
    res.json::<UserInfo>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_books(genre_id: Option<i64>) -> Result<Vec<Book>, String> {
    let url = match genre_id {
        Some(id) => format!("{}/books?genreId={}", api_base(), id),
        None => format!("{}/books", api_base()),
    };
    let res: serde_json::Value = client()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let books: Vec<Book> = serde_json::from_value(res["books"].clone()).map_err(|e| e.to_string())?;
    Ok(books)
}

#[tauri::command]
async fn get_genres() -> Result<Vec<Genre>, String> {
    let url = format!("{}/genres", api_base());
    let res: serde_json::Value = client()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let genres: Vec<Genre> = serde_json::from_value(res["genres"].clone()).map_err(|e| e.to_string())?;
    Ok(genres)
}

#[tauri::command]
async fn borrow_book(qr_id: String, barcode: String, loan_period_days: Option<i64>) -> Result<Loan, String> {
    let url = format!("{}/internal/loans/borrow", api_base());
    let body = BorrowRequest { qr_id, barcode, loan_period_days };
    let res = client()
        .post(&url)
        .header("X-API-Key", api_key())
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"].as_str().map(String::from))
            .unwrap_or_else(|| "貸出に失敗しました".to_string());
        return Err(msg);
    }
    res.json::<Loan>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn return_book(qr_id: String, barcode: String) -> Result<Loan, String> {
    let url = format!("{}/internal/loans/return", api_base());
    let body = ReturnRequest { qr_id, barcode };
    let res = client()
        .post(&url)
        .header("X-API-Key", api_key())
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"].as_str().map(String::from))
            .unwrap_or_else(|| "返却に失敗しました".to_string());
        return Err(msg);
    }
    res.json::<Loan>().await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = dotenv::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            verify_user,
            get_books,
            get_genres,
            borrow_book,
            return_book,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
