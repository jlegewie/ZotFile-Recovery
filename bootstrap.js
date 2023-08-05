var ZotFileRecovery;

function install() {
    Zotero.debug('ZotFileRecovery: Installed');
}

async function startup({ id, version, rootURI}) {
    Zotero.debug('ZotFileRecovery: Starting');
    Zotero.debug('ZotFileRecovery rootURI: ' + rootURI);
    Services.scriptloader.loadSubScript(rootURI + 'ZotFileRecovery.js');
    Services.scriptloader.loadSubScript(rootURI + 'ZotFileRecovery_menus.js');
    Zotero.ZotFileRecovery.init({ id, version, rootURI });
    ZotFileRecovery_Menus.init();
}

function shutdown() {
    Zotero.debug('ZotFileRecovery: Shutting down');
    // ZotFileRecovery.removeFromAllWindows();

    // Zotero.ZotFileRecovery.destroy();
    ZotFileRecovery_Menus.destroy();

    Zotero.ZotFileRecovery = undefined;
    ZotFileRecovery_Menus = undefined;
}

function uninstall() {
    Zotero.debug('ZotFileRecovery: Uninstalled');
}
