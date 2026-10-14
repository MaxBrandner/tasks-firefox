// Blendet die Seitenleiste ein/aus, wenn auf das Symbol in der Toolbar geklickt wird.
// sidebarAction.toggle() ist nur direkt aus einer Nutzeraktion (Klick) heraus erlaubt.
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
});
