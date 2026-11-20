export async function downloadBlobFile(blob: Blob, filename: string): Promise<void> {
  const isMobileUa =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|wv/i.test(navigator.userAgent);
  const isAndroidWebView =
    typeof navigator !== 'undefined' && /; wv\)/i.test(navigator.userAgent);

  // On Android WebView, standard <a download="blob:..."> is often ignored; prefer File Share or data URI fallback.
  if (isMobileUa && typeof File !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      const canShareFiles =
        typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShareFiles && isAndroidWebView) {
        await navigator.share({
          title: filename,
          files: [file],
        });
        return;
      }
    } catch {
      // Fall through to standard anchor / data URI download if user cancels share or share fails
    }
  }

  // Standard object URL download (works across Chrome Android, desktop browsers, and modern TWA)
  if (!isAndroidWebView) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return;
  }

  // Fallback for restrictive Android WebViews: convert smaller blobs to data URLs
  if (blob.size <= 5 * 1024 * 1024) {
    await new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const a = document.createElement('a');
          a.href = reader.result;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        resolve();
      };
      reader.readAsDataURL(blob);
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
