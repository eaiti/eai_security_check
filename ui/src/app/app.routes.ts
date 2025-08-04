import { Routes } from '@angular/router';
import { SecurityCheckComponent } from './components/security-check/security-check.component';
import { ConfigEditorComponent } from './components/config-editor/config-editor.component';

export const routes: Routes = [
  { path: '', redirectTo: '/security-check', pathMatch: 'full' },
  { path: 'security-check', component: SecurityCheckComponent },
  { path: 'config-editor', component: ConfigEditorComponent },
  // TODO: Add other routes for daemon-manager, report-viewer, interactive-mode
];
