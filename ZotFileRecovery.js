
Components.utils.importGlobalProperties(['PathUtils', 'IOUtils']);

Zotero.ZotFileRecovery = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,

    init({ id, version, rootURI }) {
        if(this.initialized) return;

        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
        this.initialized = true;

    },

    getTabletInfo (att, key) {
        try {
            var parser = new DOMParser();
            var value,
                content = att.getNote(),
                doc = parser.parseFromString(content, 'text/html'),
                p = doc.querySelector('#zotfile-data');
            if(p === null) p = doc.querySelector('[title*="lastmod"][title*="projectFolder"]');
            if(p === null) {
                // support for old system
                var search = content.search(key);
                value = content.substring(search);
                value = value.substring(value.search('{') + 1, value.search('}'));
            }
            else {
                var data = JSON.parse(p.getAttribute('title').replace(/&quot;/g, '"'));
                value = key in data ? data[key] : undefined;
            }
            // for location tag: replace [BaseFolder] with destination folder
            if(key == 'location') {
                let dest_dir = Zotero.Prefs.get('extensions.zotfile.tablet.dest_dir', true);
                dest_dir = dest_dir === undefined ? "" : dest_dir;
                value = value.replace('[BaseFolder]', dest_dir);
            }
            // for location and projectFolder tag: correct window/mac file system
            if(['location', 'projectFolder'].includes(key) && Zotero.isWin) value = value.replace(/\//g, '\\');
            if(['location', 'projectFolder'].includes(key) && !Zotero.isWin) value = value.replace(/\\/g, '/');
            // return
            return value;
        }
        catch (err) {
            return '';
        }
    },

    clearInfo (att) {
        try {
            var parser = new DOMParser();
            var content = att.getNote().replace(/zotero:\/\//g, 'http://zotfile.com/'),
                doc = parser.parseFromString(content, 'text/html'),
                p = doc.querySelector('#zotfile-data');
            if(p === null) p = doc.querySelector('[title*="lastmod"][title*="projectFolder"]');
            if (p !== null) doc.removeChild(p);
            // save content back to note
            content = doc.documentElement.innerHTML
                // remove old zotfile data
                .replace(/(lastmod|mode|location|projectFolder)\{.*?\};?/g,'')
                // replace links with zotero links
                .replace(/http:\/\/zotfile.com\//g, 'zotero://');
            att.setNote(content);
        }
        catch(e) {
            att.setNote('');
        }
    },

    _getSelectedAttachments() {
        let atts = Zotero.getActiveZoteroPane().getSelectedItems()
            .map(item => item.isRegularItem() ? item.getAttachments() : item)
            .reduce((a, b) => a.concat(b), [])
            .map(item => typeof item == 'number' ? Zotero.Items.get(item) : item)
            .filter(item => item.isAttachment())
            .filter(item => this.getTabletInfo(item, 'mode') == 1);
        return atts;
    },

    removeTabletTag(att, tag) {
        // remove from attachment
        att.removeTag(tag);
        // remove from parent item
        var item = Zotero.Items.get(att.parentItemID);
        if(item.hasTag(tag)) {
            var atts = Zotero.Items.get(item.getAttachments());
            if(!atts.some(att => att.hasTag(tag)))
                item.removeTag(tag);
        }
    },

    // async recoverTabletFile() {
    async recoverTabletFile() {
        Zotero.debug("ZotFileRecovery: Running 'recoverTabletFile'");
        // get selected attachments
        let atts = this._getSelectedAttachments();
        // filter by tablet tag
        let tablet_tag = Zotero.Prefs.get('extensions.zotfile.tablet.tag', true);
        tablet_tag = tablet_tag === undefined ? "_tablet" : tablet_tag;
        atts = atts.filter(att => att.hasTag(tablet_tag));
        if(atts.length == 0) return;
        // get attachments from tablet
        atts = atts.map(att => this.getAttachmentFromTablet(att));
        return;
    },

    async getTabletFilePath(att) {
        Zotero.debug("ZotFileRecovery: Running 'getTabletFilePath'");
        // foreground mode
        if(this.getTabletInfo(att, 'mode') == 2)
            return await att.getFilePathAsync();
        // background mode
        var path = this.getTabletInfo(att, 'location');
        return path;
    },

    promptUser(message,but_0,but_1_cancel,but_2, title) {
        var title = typeof title !== 'ZotFile Dialog' ? title : true;
        var prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
                    .getService(Components.interfaces.nsIPromptService);

        var check = {value: false};                  // default the checkbox to false

        var flags = prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
                prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_IS_STRING  +
                prompts.BUTTON_POS_2 * prompts.BUTTON_TITLE_IS_STRING;

        var button = prompts.confirmEx(null, title, message,
                    flags,  but_0,but_1_cancel,but_2, null, check);

        return(button);

    },

    getPref(pref, def) {
        let value = Zotero.Prefs.get('extensions.zotfile.' + pref, true);
        value = value === undefined ? def : value;;
        return value;
    },

    // async getAttachmentFromTablet(att) {
    async getAttachmentFromTablet(att) {
        Zotero.debug("ZotFileRecovery: Running 'getAttachmentFromTablet'");
        var item = Zotero.Items.get(att.parentItemID),
            tablet_tag = this.getPref('tablet.tag', '_tablet'),
            tablet_tagMod = this.getPref('tablet.tagModified', '_tablet_modified'),
            tag_parent = this.getPref('tablet.tagParentPush_tag', '_tablet_parent');
        // Zotero and tablet file paths
        var path_zotero = await att.getFilePathAsync(),
            path_tablet = await this.getTabletFilePath(att, false);
        Zotero.debug("ZotFileRecovery 'path_tablet': " + path_tablet);
        Zotero.debug("ZotFileRecovery 'path_zotero':" + path_zotero);
        var path_tablet_exists = await IOUtils.exists(path_tablet);
        if (path_tablet == '' | !path_tablet_exists) {
            this.removeTabletTag(att, tablet_tag);
            this.clearInfo(att);
            await att.saveTx();
            await item.saveTx();
            this.infoWindow('ZotFile Warning', 'The tablet file "' + att.attachmentFilename + '" was manually moved and does not exist.');
            return att;
        }
        // get modification times for files        
        var time_tablet = 0, time_zotero = 0;
        if(await IOUtils.exists(path_tablet)) {
            let tablet_file_stat = await IOUtils.stat(path_tablet);
            time_tablet = tablet_file_stat.lastModified;
        }
        var time_saved  = parseInt(this.getTabletInfo(att, 'lastmod'), 10);
        if(await IOUtils.exists(path_zotero)) {
            let zotero_file_stat = await IOUtils.stat(path_zotero);
            time_zotero = zotero_file_stat.lastModified;
        }
        Zotero.debug("ZotFileRecovery lastModified (tablet, saved, zotero): " + time_tablet + " " + time_saved + " " + time_zotero);
        // background mode
        if((time_tablet == 0 & time_zotero == 0)) {
            this.infoWindow('ZotFile Warning', 'Recovery of tablet file "' + att.attachmentFilename + '" failed. Please manually recover the file at "' + path_tablet + '"');
            return att;
        }

        // Status of tablet file 'tablet_status'
        // 0 - Tablet file modified -> Replace zotero file
        // 1 - Both files modified -> Prompt user
        // 2 - Zotero file modified -> Delete tablet file
        var tablet_status = 1;
        if (time_tablet > time_saved  && time_zotero <= time_saved) tablet_status = 0;
        if (time_tablet <= time_saved && time_zotero <= time_saved) tablet_status = 2;
        if (time_tablet <= time_saved && time_zotero > time_saved) tablet_status = 2;
        if (time_tablet > time_saved  && time_zotero > time_saved) tablet_status = 1;
        Zotero.debug("ZotFileRecovery 'tablet_status': " + tablet_status);

        // prompt if both file have been modified
        if (tablet_status == 1) {
            let message = "Both copies of the attachment file '" + att.attachmentFilename + "'  have been modified. What do you want to do?\n\nRemoving the tablet file discards all changes made to the file on the tablet.";
            tablet_status = this.promptUser(message, "Replace Zotero File", "Cancel", "Remove Tablet File");
            if (tablet_status == 1) return;
        }
        
        // Replace zotero file
        if(tablet_status == 0) 
            await IOUtils.move(path_tablet, path_zotero);
        // Remove tablet file
        if(tablet_status == 2)
            await Zotero.File.removeIfExists(path_tablet);
        
        // remove tag from attachment and parent item
        this.removeTabletTag(att, tablet_tag);
        if(item.hasTag(tag_parent)) item.removeTag(tag_parent);
        // clear attachment note
        this.Tablet.clearInfo(att);
        // remove modified tag from attachment
        this.removeTabletTag(att, this.Tablet.tagMod);
        await att.saveTx();
        await item.saveTx();
        // notification
        this.infoWindow('ZotFile Recovery', 'The tablet file "' + att.attachmentFilename + '" was removed from the tablet.');
        // return...
        return att;
    },

    infoWindow (headline, content) {
        // default arguments
        main = typeof main !== 'undefined' ? main : 'title';
        message = typeof message !== 'undefined' ? message : 'message';
        // show window
        var progressWin = new Zotero.ProgressWindow();
        progressWin.changeHeadline(headline);
        progressWin.addLines(content);
        progressWin.show();
        progressWin.startCloseTimer();
    },


};
