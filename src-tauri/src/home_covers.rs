use crate::db::{err,Result};
use serde::Serialize;
use sha2::{Digest,Sha256};
use std::{io::{Cursor,Write},path::Path};

#[derive(Serialize)]
pub struct Cover {pub path:String,pub width:u32,pub height:u32}
// Store an owned, decoded copy; never retain a dependency on the dropped source file.
pub fn save(data:&Path,bytes:&[u8])->Result<Cover>{
    if bytes.is_empty()||bytes.len()>12*1024*1024{return Err("Choose an image smaller than 12 MB after resizing.".into());}
    let mut reader=image::ImageReader::new(Cursor::new(bytes)).with_guessed_format().map_err(err)?;
    let mut limits=image::Limits::default();limits.max_image_width=Some(4096);limits.max_image_height=Some(4096);limits.max_alloc=Some(64*1024*1024);reader.limits(limits);
    let image=reader.decode().map_err(|_|"This file could not be read as an image.".to_string())?.thumbnail(1600,1600);
    let (width,height)=(image.width(),image.height());let mut encoded=Cursor::new(Vec::new());image.write_to(&mut encoded,image::ImageFormat::Png).map_err(err)?;let encoded=encoded.into_inner();
    let directory=data.join("home-covers");std::fs::create_dir_all(&directory).map_err(err)?;
    let path=directory.join(format!("{:x}.png",Sha256::digest(&encoded)));
    if !path.exists(){let mut temp=tempfile::NamedTempFile::new_in(&directory).map_err(err)?;temp.write_all(&encoded).map_err(err)?;if let Err(error)=temp.persist_noclobber(&path){if !path.is_file(){return Err(err(error));}}}
    Ok(Cover{path:path.to_string_lossy().into_owned(),width,height})
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn cover_is_resized_owned_and_reused_without_library_changes(){
  let temp=tempfile::tempdir().unwrap();let image=image::DynamicImage::new_rgba8(2400,1200);let mut bytes=Cursor::new(Vec::new());image.write_to(&mut bytes,image::ImageFormat::Png).unwrap();
  let cover=save(temp.path(),bytes.get_ref()).unwrap();assert_eq!((cover.width,cover.height),(1600,800));assert!(Path::new(&cover.path).is_file());assert_eq!(image::image_dimensions(&cover.path).unwrap(),(1600,800));
  assert_eq!(save(temp.path(),bytes.get_ref()).unwrap().path,cover.path);assert_eq!(std::fs::read_dir(temp.path().join("home-covers")).unwrap().count(),1);assert!(!temp.path().join("library.sqlite").exists());
 }
 #[test] fn invalid_or_oversized_payload_does_not_create_a_cover(){
  let temp=tempfile::tempdir().unwrap();assert!(save(temp.path(),b"not an image").is_err());assert!(save(temp.path(),&vec![0;12*1024*1024+1]).is_err());assert!(!temp.path().join("home-covers").exists());
 }
}
