const DB_NAME = "quoteforge-enquiry-photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

type PhotoBlobRecord = {
  key: string;
  enquiryId: string;
  photoId: string;
  blob: Blob;
  savedAt: string;
};

function blobKey(enquiryId: string, photoId: string): string {
  return `${enquiryId}:${photoId}`;
}

function openPhotoBlobDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open photo blob database"));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function saveEnquiryPhotoBlob(
  enquiryId: string,
  photoId: string,
  blob: Blob
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const database = await openPhotoBlobDatabase();
    const record: PhotoBlobRecord = {
      key: blobKey(enquiryId, photoId),
      enquiryId,
      photoId,
      blob,
      savedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to save enquiry photo blob"));
      };

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error ?? new Error("Failed to save enquiry photo blob"));
      };
    });
  } catch {
    // Prototype-only storage — ignore quota or privacy errors.
  }
}

export async function getEnquiryPhotoBlob(
  enquiryId: string,
  photoId: string
): Promise<Blob | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const database = await openPhotoBlobDatabase();

    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(blobKey(enquiryId, photoId));

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read enquiry photo blob"));
      };

      request.onsuccess = () => {
        const record = request.result as PhotoBlobRecord | undefined;
        resolve(record?.blob ?? null);
      };

      transaction.oncomplete = () => {
        database.close();
      };
    });
  } catch {
    return null;
  }
}
