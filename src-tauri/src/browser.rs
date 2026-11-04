use crate::db::{err, valid_url, Result};

pub fn open(url: &str) -> Result<()> {
    let url = valid_url(url)?;
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(err)
}

#[cfg(test)]
mod tests {
    #[test]
    fn external_links_accept_only_web_urls_and_trim_pasted_spacing() {
        assert_eq!(
            crate::db::valid_url(" https://www.behance.net/galleries/ui-ux\u{a0}").unwrap(),
            "https://www.behance.net/galleries/ui-ux"
        );
        for url in [
            "javascript:alert(1)",
            "file:///C:/test",
            "--incognito",
            "https://example.com/ bad",
        ] {
            assert!(crate::db::valid_url(url).is_err());
        }
    }
}
