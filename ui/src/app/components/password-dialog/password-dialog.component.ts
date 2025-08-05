import {
  ChangeDetectionStrategy,
  Component,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <div class="password-dialog" (click)="$event.stopPropagation()">
        <h3>🔐 Administrator Password Required</h3>
        <p>
          Some security checks require administrator privileges to access system
          information. Please enter your password to continue.
        </p>

        <form (ngSubmit)="onSubmit()" #passwordForm="ngForm">
          <div class="form-group">
            <label for="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              [(ngModel)]="password"
              required
              #passwordInput="ngModel"
              class="password-input"
              autocomplete="current-password"
              (keydown.escape)="onCancel()"
            />
            @if (passwordInput.invalid && passwordInput.touched) {
              <div class="error-message">Password is required</div>
            }
          </div>

          @if (errorMessage()) {
            <div class="error-banner">
              {{ errorMessage() }}
            </div>
          }

          <div class="dialog-actions">
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="passwordForm.invalid || isSubmitting()"
            >
              @if (isSubmitting()) {
                🔄 Verifying...
              } @else {
                🔐 Continue
              }
            </button>
            <button type="button" class="btn btn-secondary" (click)="onCancel()">
              Cancel
            </button>
          </div>
        </form>

        <div class="security-note">
          <small>
            🛡️ Your password is only used for this session and is not stored.
          </small>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./password-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordDialogComponent {
  password = '';
  private readonly _errorMessage = signal<string>('');
  private readonly _isSubmitting = signal<boolean>(false);

  readonly errorMessage = this._errorMessage.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();

  readonly passwordSubmitted = output<string>();
  readonly dialogCancelled = output<void>();

  async onSubmit(): Promise<void> {
    if (!this.password.trim()) {
      this._errorMessage.set('Password is required');
      return;
    }

    this._isSubmitting.set(true);
    this._errorMessage.set('');

    // Emit the password to the parent component
    this.passwordSubmitted.emit(this.password);
  }

  onCancel(): void {
    this.dialogCancelled.emit();
  }

  setError(error: string): void {
    this._errorMessage.set(error);
    this._isSubmitting.set(false);
  }

  setSubmitting(submitting: boolean): void {
    this._isSubmitting.set(submitting);
  }
}