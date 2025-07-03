// Utility to import menu.csv into localStorage for the current user
// Usage: Call importMenuCsvToLocalStorage(currentUserId)

export async function importMenuCsvToLocalStorage(currentUserId: string) {
  if (!currentUserId) {
    alert('No current user.');
    return;
  }
  try {
    const res = await fetch('/api/menuCsv');
    if (!res.ok) throw new Error('Failed to fetch menu CSV');
    const data = await res.json();
    if (!Array.isArray(data.menu)) throw new Error('Menu data not found');
    localStorage.setItem(`restaurantMenu_${currentUserId}`, JSON.stringify(data.menu));
    // Notify other tabs/pages
    window.dispatchEvent(new Event('menu-imported'));
    alert('Menu imported from CSV and saved to localStorage!');
  } catch (e) {
    alert('Error importing menu: ' + e);
  }
}
