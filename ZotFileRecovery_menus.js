
Components.utils.import('resource://gre/modules/Services.jsm');

ZotFileRecovery_Menus = {
    _store_added_elements: [],
    _opt_disable_elements: [],

    _window_listener: {
        onOpenWindow: function(a_window) {
            let dom_window = a_window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
            dom_window.addEventListener('load', function() {
                dom_window.removeEventListener('load', arguments.callee, false);
                if (dom_window.document.documentElement.getAttribute('windowtype') != 'navigator:browser') return;
                ZotFileRecovery_Menus._store_added_elements = []; // Clear tracked elements since destroyed by closed window
                ZotFileRecovery_Menus._opt_disable_elements = [];
                ZotFileRecovery_Menus._init();
            }, false);
        }
    },

    _popupShowing() {
        // let should_hide = !ZotFileRecovery_Menus._hasTabletFile();
        let should_disabled = !ZotFileRecovery_Menus._hasTabletFile();
        for (let element of ZotFileRecovery_Menus._opt_disable_elements) {
            // element.hidden = should_hide;
            element.disabled = should_disabled;
        }
    },

    _getWindow() {
        let enumerator = Services.wm.getEnumerator('navigator:browser');
        while (enumerator.hasMoreElements())
        {
            let win = enumerator.getNext();
            if (!win.ZoteroPane) continue;
            return win;
        }
    },    

    _hasTabletFile() {
        let atts = Zotero.ZotFileRecovery._getSelectedAttachments();
        let tablet_tag = Zotero.ZotFileRecovery.getPref('tablet.tag', '_tablet');
        return atts.some(att => att.hasTag(tablet_tag));
    },

    init() {
        this._init();
        Services.wm.addListener(this._window_listener);
    },

    _init() {
        let win = this._getWindow();
        let doc = win.document;

        // Menu separator
        let menuseparator = doc.createXULElement('menuseparator');
        // Move Selected Menu item
        let recovery_item = doc.createXULElement('menuitem');
        recovery_item.id = 'ZotFileRecovery-recover-file';
        recovery_item.setAttribute('data-l10n-id', 'ZotFileRecovery-recover-file');
        recovery_item.addEventListener('command', function() {
            Zotero.ZotFileRecovery.recoverTabletFile();
        });
        let zotero_itemmenu = doc.getElementById('zotero-itemmenu');
        zotero_itemmenu.addEventListener('popupshowing', this._popupShowing);
        zotero_itemmenu.appendChild(menuseparator);
        zotero_itemmenu.appendChild(recovery_item);
        this._store_added_elements.push(menuseparator, recovery_item);
        this._opt_disable_elements.push(menuseparator, recovery_item);

        // Enable localization
        win.MozXULElement.insertFTLIfNeeded('ZotFileRecovery.ftl');
    },

    destroy() {
        this._destroy();
        Services.wm.removeListener(this._window_listener);
    },

    _destroy() {
        let doc = this._getWindow().document;
        for (let element of this._store_added_elements) {
            if (element) element.remove();
        }
        doc.querySelector('[href="ZotFileRecovery.ftl"]').remove();

        let zotero_itemmenu = doc.getElementById('zotero-itemmenu');
        zotero_itemmenu.removeEventListener('popupshowing', this._popupShowing);

        this._store_added_elements = [];
        this._opt_disable_elements = [];
    }
}
