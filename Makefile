all: Makefile.in

-include Makefile.in

RELEASE:=$(shell grep version manifest.json | sed '2q;d' | sed -e 's/^ *"version": "//' -e 's/",//')

ZotFileRecovery.xpi: FORCE
	rm -rf $@
	zip -FSr $@ bootstrap.js locale manifest.json ZotFileRecovery.js ZotFileRecovery_menus.js -x \*.DS_Store

ZotFileRecovery-%-fx.xpi: ZotFileRecovery.xpi
	mv $< $@

Makefile.in: manifest.json
	echo "all: ZotFileRecovery-${RELEASE}-fx.xpi" > Makefile.in

FORCE:
