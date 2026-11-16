import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportedLanguage } from '../../i18n/translations';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-selector-group" role="group" [attr.aria-label]="t.t('common.language')">
      @for (item of t.supportedLanguages; track item.code) {
        <button
          type="button"
          class="lang-pill-btn"
          [class.active]="t.currentLanguage() === item.code"
          [attr.aria-pressed]="t.currentLanguage() === item.code"
          (click)="selectLanguage(item.code)"
          [title]="item.label">
          <span class="flag" aria-hidden="true">{{ item.flag }}</span>
          <span class="code">{{ item.code.toUpperCase() }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .lang-selector-group {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      padding: 2px;
      gap: 2px;
    }
    .lang-pill-btn {
      background: transparent;
      border: none;
      border-radius: 999px;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 8px;
      line-height: 1;
      min-height: 28px;
      transition: all 0.15s ease-in-out;
    }
    .lang-pill-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
    }
    .lang-pill-btn.active {
      background: #7453c8;
      color: #fff;
      box-shadow: 0 2px 6px rgba(116, 83, 200, 0.4);
    }
    .flag {
      font-size: 0.85rem;
      line-height: 1;
    }
    .code {
      letter-spacing: 0.04em;
    }
    @media (max-width: 480px) {
      .lang-pill-btn {
        padding: 4px 6px;
        font-size: 0.65rem;
      }
      .code {
        display: none;
      }
    }
  `],
})
export class LanguageSelectorComponent {
  readonly t = inject(TranslationService);

  selectLanguage(lang: SupportedLanguage): void {
    this.t.setLanguage(lang);
  }
}

