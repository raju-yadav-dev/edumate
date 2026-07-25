
export async function uploadFile(formData) {
    const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
    });

    return response.json();
}