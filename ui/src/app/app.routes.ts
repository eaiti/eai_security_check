import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { SecurityCheckComponent } from './components/security-check/security-check.component';
import { ConfigEditorComponent } from './components/config-editor/config-editor.component';
import { DaemonManagerComponent } from './components/daemon-manager/daemon-manager.component';
import { ReportViewerComponent } from './components/report-viewer/report-viewer.component';
import { ManagementComponent } from './components/management/management.component';
import { ReportVerification } from './components/report-verification/report-verification';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'security-check', component: SecurityCheckComponent },
  { path: 'config-editor', component: ConfigEditorComponent },
  { path: 'daemon-manager', component: DaemonManagerComponent },
  { path: 'report-viewer', component: ReportViewerComponent },
  { path: 'report-verification', component: ReportVerification },
  { path: 'management', component: ManagementComponent },
];
