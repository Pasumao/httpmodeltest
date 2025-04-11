/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"comaspntools/ybcpi0040/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
