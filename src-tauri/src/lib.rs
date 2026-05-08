use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::sync::OnceLock;
use std::sync::RwLock;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static API_BASE: OnceLock<String> = OnceLock::new();
static CORE_API_BASE: OnceLock<String> = OnceLock::new();
static API_KEY_VAL: RwLock<String> = RwLock::new(String::new());

fn client() -> &'static Client {
    HTTP_CLIENT.get_or_init(Client::new)
}

fn api_base() -> &'static str {
    API_BASE.get_or_init(|| std::env::var("API_BASE_URL").unwrap_or_else(|_| "http://localhost/api/library".to_string()))
}

fn core_api_base() -> &'static str {
    CORE_API_BASE.get_or_init(|| std::env::var("CORE_API_BASE_URL").unwrap_or_else(|_| "http://localhost/api/core".to_string()))
}

fn api_key() -> String {
    API_KEY_VAL.read().unwrap().clone()
}

#[tauri::command]
fn set_api_key(key: String) {
    *API_KEY_VAL.write().unwrap() = key;
}

#[tauri::command]
fn get_api_key() -> String {
    api_key()
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

#[derive(Serialize, Deserialize)]
pub struct Genre {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedBook {
    pub id: i64,
    pub title: String,
    pub barcode: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: i64,
    pub barcode: String,
    pub title: String,
    pub authors: Vec<String>,
    pub thumbnail_link: String,
    pub genre: GenreRef,
    pub stock: Stock,
}

#[derive(Serialize, Deserialize)]
pub struct GenreRef {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stock {
    pub total: i64,
    pub loaned_count: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleBookInfo {
    pub title: String,
    pub authors: Vec<String>,
    pub thumbnail: Option<String>,
}

#[tauri::command]
async fn fetch_book_info_by_isbn(isbn: String) -> Result<Option<GoogleBookInfo>, String> {
    let url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{}", isbn);
    let res = client().get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let total = body["totalItems"].as_i64().unwrap_or(0);
    if total == 0 {
        return Ok(None);
    }
    let item = &body["items"][0]["volumeInfo"];
    let title = item["title"].as_str().unwrap_or("").to_string();
    let authors = item["authors"].as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let thumbnail = item["imageLinks"]["thumbnail"].as_str().map(String::from);
    Ok(Some(GoogleBookInfo { title, authors, thumbnail }))
}

#[tauri::command]
async fn verify_admin_password(admin_password: String) -> Result<bool, String> {
    let url = format!("{}/internal/auth/verify", api_base());
    let res = client()
        .post(&url)
        .header("X-API-Key", api_key())
        .header("X-Admin-Password", &admin_password)
        .send().await.map_err(|e| e.to_string())?;
    Ok(res.status().is_success())
}

#[tauri::command]
async fn find_book_by_barcode(barcode: String) -> Result<Option<Book>, String> {
    let url = format!("{}/books/{}", api_base(), barcode);
    let res = client().get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let book: Book = res.json().await.map_err(|e| e.to_string())?;
    Ok(Some(book))
}

#[tauri::command]
async fn update_book(id: i64, admin_password: String, barcode: Option<String>, title: Option<String>, authors: Option<Vec<String>>, genre_id: Option<i64>, total: Option<i64>, thumbnail_path: Option<String>) -> Result<CreatedBook, String> {
    let url = format!("{}/internal/books/{}", api_base(), id);

    let mut data = serde_json::Map::new();
    if let Some(v) = barcode { data.insert("barcode".into(), v.into()); }
    if let Some(v) = title { data.insert("title".into(), v.into()); }
    if let Some(v) = authors { data.insert("authors".into(), serde_json::to_value(v).unwrap()); }
    if let Some(v) = genre_id { data.insert("genreId".into(), v.into()); }
    if let Some(v) = total { data.insert("total".into(), v.into()); }

    let mut form = reqwest::multipart::Form::new();
    if !data.is_empty() {
        form = form.text("data", serde_json::Value::Object(data).to_string());
    }
    if let Some(path) = thumbnail_path {
        let bytes = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;
        let filename = std::path::Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
        let mime = if filename.ends_with(".png") { "image/png" } else if filename.ends_with(".webp") { "image/webp" } else { "image/jpeg" };
        let part = reqwest::multipart::Part::bytes(bytes).file_name(filename).mime_str(mime).map_err(|e| e.to_string())?;
        form = form.part("thumbnail", part);
    }

    let res = client()
        .patch(&url)
        .header("X-API-Key", api_key())
        .header("X-Admin-Password", admin_password)
        .multipart(form)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text).ok().and_then(|v| v["error"].as_str().map(String::from)).unwrap_or_else(|| "更新に失敗しました".to_string());
        return Err(msg);
    }
    res.json::<CreatedBook>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_book(id: i64, admin_password: String) -> Result<(), String> {
    let url = format!("{}/internal/books/{}", api_base(), id);
    let res = client()
        .delete(&url)
        .header("X-API-Key", api_key())
        .header("X-Admin-Password", admin_password)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text).ok().and_then(|v| v["error"].as_str().map(String::from)).unwrap_or_else(|| "削除に失敗しました".to_string());
        return Err(msg);
    }
    Ok(())
}

#[tauri::command]
async fn get_genres() -> Result<Vec<Genre>, String> {
    let url = format!("{}/genres", api_base());
    let res: serde_json::Value = client()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    serde_json::from_value(res["genres"].clone()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_book(barcode: String, title: String, authors: Vec<String>, genre_id: i64, total: i64, thumbnail_path: String, admin_password: String) -> Result<CreatedBook, String> {
    let url = format!("{}/internal/books", api_base());

    let data = serde_json::json!({
        "barcode": barcode,
        "title": title,
        "authors": authors,
        "genreId": genre_id,
        "total": total,
    });

    let bytes = tokio::fs::read(&thumbnail_path).await.map_err(|e| e.to_string())?;
    let filename = std::path::Path::new(&thumbnail_path).file_name().unwrap_or_default().to_string_lossy().to_string();
    let mime = if filename.ends_with(".png") { "image/png" } else if filename.ends_with(".webp") { "image/webp" } else { "image/jpeg" };
    let part = reqwest::multipart::Part::bytes(bytes).file_name(filename).mime_str(mime).map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new()
        .text("data", data.to_string())
        .part("thumbnail", part);

    let res = client()
        .post(&url)
        .header("X-API-Key", api_key())
        .header("X-Admin-Password", admin_password)
        .multipart(form)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| {
                v["error"].as_str().map(String::from)
                    .or_else(|| v["error"]["message"].as_str().map(String::from))
                    .or_else(|| Some(v.to_string()))
            })
            .unwrap_or(text);
        return Err(msg);
    }
    res.json::<CreatedBook>().await.map_err(|e| e.to_string())
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
    let _ = dotenv::from_filename(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env"));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            set_api_key,
            get_api_key,
            verify_user,
            borrow_book,
            return_book,
            get_genres,
            add_book,
            find_book_by_barcode,
            fetch_book_info_by_isbn,
            update_book,
            delete_book,
            verify_admin_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
