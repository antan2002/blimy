fn main() {
   if std::env::var_os("CARGO_FEATURE_LINUX").is_some()
      && std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux")
   {
      println!("cargo:rustc-link-arg-bin=Blimy=-Wl,-rpath,$ORIGIN");
      println!("cargo:rustc-link-arg-bin=Blimy=-Wl,-rpath,$ORIGIN/../lib/Blimy");
      println!("cargo:rustc-link-arg-bin=Blimy=-Wl,-rpath,$ORIGIN/../lib/Blimy Preview");
   }

   tauri_build::build()
}
