/*global QUnit*/

sap.ui.define([
	"com/atg/ppm/postfinrevenue/controller/ProjectCostReport.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ProjectCostReport Controller");

	QUnit.test("I should test the ProjectCostReport controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
