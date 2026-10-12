import successSoundPath from "@/assets/success.mp3";

export function playNotificationSound() {
  try {
    const audio = new Audio(successSoundPath);
    audio.volume = 0.5;
    audio.play().catch((err) => {
      console.error("Failed to play notification sound", err);
    });
  } catch (err) {
    console.error("Failed to initialize notification sound", err);
  }
}
