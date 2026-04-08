const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

export async function subirFotoADrive({ archivo, nombreArchivo, torneoNombre, clubNombre }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        const mimeType = archivo.type;

        const response = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            torneoNombre,
            clubNombre,
            nombreArchivo,
            base64,
            mimeType
          })
        });

        const data = await response.json();
        if (data.ok) {
          resolve({ url: data.url, id: data.id });
        } else {
          reject(new Error(data.error));
        }
      } catch(err) {
        reject(err);
      }
    };
    reader.readAsDataURL(archivo);
  });
}

export function generarNombreCarnet(apellido, nombre, categoria) {
  const nombreLimpio = `${categoria}-${apellido} ${nombre}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s\-]/g, "")
    .trim();
  return `${nombreLimpio}.jpg`;
}

export function generarNombreDniFrente(apellido, nombre, dni) {
  const nombreLimpio = `DNI-F-${apellido} ${nombre}-${dni}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s\-]/g, "")
    .trim();
  return `${nombreLimpio}.jpg`;
}

export function generarNombreDniDorso(apellido, nombre, dni) {
  const nombreLimpio = `DNI-D-${apellido} ${nombre}-${dni}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s\-]/g, "")
    .trim();
  return `${nombreLimpio}.jpg`;
}

export function urlVisualizacion(urlDrive) {
  if (!urlDrive) return "";
  const match = urlDrive.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
  }
  const match2 = urlDrive.match(/id=([a-zA-Z0-9_-]+)/);
  if (match2) {
    return `https://drive.google.com/thumbnail?id=${match2[1]}&sz=w400`;
  }
  return urlDrive;
}
