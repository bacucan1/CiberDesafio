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
      background: rgba(16, 13, 27, 0.92);
      border: 1px solid rgba(214, 189, 116, 0.42);
      border-radius: 2px;
      padding: 2px;
      gap: 2px;
    }
    .lang-pill-btn {
      background: transparent;
      border: none;
      border-radius: 1px;
      color: #c0b79e;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 8px;
      line-height: 1;
      min-height: 28px;
      transition: all 0.15s ease-in-out;
    }
    .lang-pill-btn:hover {
      color: #f3e7c1;
      background: rgba(214, 189, 116, 0.12);
    }
    .lang-pill-btn.active {
      background: linear-gradient(135deg, #ead89a, #c59a4a);
      color: #201506;
      box-shadow: 0 2px 6px rgba(214, 189, 116, 0.25);
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

