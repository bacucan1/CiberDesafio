import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, checkmarkCircle, closeCircle, refresh, shieldCheckmark, sparkles, warning } from 'ionicons/icons';
import { AiExercise, AiExerciseOption, AiExerciseService, DifficultyLevel } from '../../services/ai-exercise.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-ai-challenge-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, TranslatePipe],
  template: `
    <div class="ai-modal-backdrop" (click)="onBackdropClick($event)">
      <div class="ai-modal-container" role="dialog" aria-modal="true" [attr.aria-labelledby]="'ai-modal-title'">
        
        <!-- Header -->
        <header class="ai-modal-header">
          <div class="header-titles">
            <span class="ai-chip">
              <ion-icon name="sparkles" aria-hidden="true"></ion-icon>
              {{ 'game.aiModeBadge' | translate }}
            </span>
            <h2 id="ai-modal-title">{{ 'aiChallenge.modalTitle' | translate }}</h2>
            <p class="subtitle">{{ 'aiChallenge.subtitle' | translate }}</p>
          </div>
          <button type="button" class="close-btn" (click)="close()" [attr.aria-label]="'aiChallenge.closeMode' | translate">
            <ion-icon name="close-circle" aria-hidden="true"></ion-icon>
          </button>
        </header>

        <!-- Controls Toolbar -->
        <section class="ai-controls-bar">
          <div class="difficulty-picker">
            <label for="diff-select">{{ 'aiChallenge.difficulty' | translate }}:</label>
            <select id="diff-select" [(ngModel)]="difficulty" (change)="generateNew()">
              <option value="easy">{{ 'aiChallenge.diffEasy' | translate }}</option>
              <option value="medium">{{ 'aiChallenge.diffMedium' | translate }}</option>
              <option value="hard">{{ 'aiChallenge.diffHard' | translate }}</option>
            </select>
          </div>
          <button type="button" class="gen-btn" (click)="generateNew()" [disabled]="loading">
            <ion-icon name="refresh" aria-hidden="true"></ion-icon>
            {{ 'aiChallenge.generateNew' | translate }}
          </button>
        </section>

        <!-- Exercise Body -->
        @if (exercise) {
          <div class="exercise-card">
            
            <!-- Meta Tags -->
            <div class="meta-row">
              <span class="threat-tag" [ngClass]="exercise.threatLevel.toLowerCase()">
                <ion-icon name="warning" aria-hidden="true"></ion-icon>
                {{ 'aiChallenge.threatLevel' | translate }}: {{ exercise.threatLevel }}
              </span>
              <span class="vector-tag">
                <ion-icon name="shield-checkmark" aria-hidden="true"></ion-icon>
                {{ exercise.vector }}
              </span>
              <span class="mitre-tag">
                MITRE: {{ exercise.mitreCode }}
              </span>
            </div>

            <!-- Incident Narrative -->
            <div class="narrative-box">
              <h3>{{ exercise.scenarioTitle }}</h3>
              <p class="desc">{{ exercise.scenarioDescription }}</p>
              
              <div class="clue-grid">
                <div class="clue-item">
                  <strong>{{ 'aiChallenge.scenarioTarget' | translate }}:</strong>
                  <span>{{ exercise.targetRole }}</span>
                </div>
                <div class="clue-item">
                  <strong>Origen / Remitente:</strong>
                  <code>{{ exercise.incidentDetails.senderOrSource }}</code>
                </div>
                <div class="clue-item full-width">
                  <strong>Factor Crítico / Urgencia:</strong>
                  <span>{{ exercise.incidentDetails.triggerUrgency }}</span>
                </div>
              </div>
            </div>

            <!-- Options Selection (Before answering) -->
            @if (!selectedOption) {
              <div class="options-container">
                <h4>{{ 'aiChallenge.chooseOption' | translate }}</h4>
                <div class="options-list">
                  @for (opt of exercise.options; track opt.id; let idx = $index) {
                    <button type="button" class="option-card" (click)="selectOption(opt)">
                      <span class="opt-index">{{ idx === 0 ? 'A' : idx === 1 ? 'B' : 'C' }}</span>
                      <span class="opt-text">{{ opt.text }}</span>
                    </button>
                  }
                </div>
              </div>
            } @else {
              <!-- AI Feedback Diagnostic (After answering) -->
              <div class="feedback-container" [class.success]="selectedOption.isCorrect" [class.danger]="!selectedOption.isCorrect">
                <div class="feedback-header">
                  <ion-icon [name]="selectedOption.isCorrect ? 'checkmark-circle' : 'alert-circle'" aria-hidden="true"></ion-icon>
                  <div>
                    <h4>{{ selectedOption.isCorrect ? ('aiChallenge.correctBadge' | translate) : ('aiChallenge.riskBadge' | translate) }}</h4>
                    <p class="consequence">{{ selectedOption.consequence }}</p>
                  </div>
                </div>

                <div class="diagnostic-body">
                  <p class="explanation">
                    <strong>{{ 'aiChallenge.aiAnalysis' | translate }}:</strong> {{ selectedOption.feedback }}
                  </p>
                  
                  <div class="mitre-box">
                    <p><strong>{{ 'aiChallenge.mitreTechnique' | translate }}:</strong> {{ exercise.mitreAttackTechnique }} ({{ exercise.mitreCode }})</p>
                    <p><strong>{{ 'aiChallenge.defenseTip' | translate }}:</strong> {{ exercise.cisoRecommendation }}</p>
                  </div>

                  <div class="points-earned">
                    <span>{{ 'aiChallenge.scoreEarned' | translate }}:</span>
                    <strong>+{{ selectedOption.isCorrect ? 120 : 25 }} XP</strong>
                  </div>
                  @if (saving) {
                    <p role="status">Guardando tu puntaje…</p>
                  } @else if (saveError) {
                    <p role="alert">{{ saveError }}</p>
                    <button type="button" class="action-btn-secondary" (click)="retrySaving()">Reintentar guardado</button>
                  } @else if (savedAwardId === selectedAwardId) {
                    <p role="status">Puntaje guardado en tu progreso.</p>
                  }
                </div>

                <div class="feedback-actions">
                  <button type="button" class="action-btn-primary" (click)="generateNew()">
                    <ion-icon name="refresh" aria-hidden="true"></ion-icon>
                    {{ 'aiChallenge.nextChallenge' | translate }}
                  </button>
                  <button type="button" class="action-btn-secondary" (click)="close()">
                    {{ 'common.back' | translate }}
                  </button>
                </div>
              </div>
            }

          </div>
        }

        <footer class="ai-modal-footer">
          <small>{{ 'aiChallenge.aiEngineStatus' | translate }}</small>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    .ai-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(4, 6, 18, 0.9);
      background-image: radial-gradient(rgba(234,216,154,.55) 1px, transparent 1px), radial-gradient(rgba(103,230,192,.35) 1px, transparent 1px);
      background-position: 0 0, 43px 37px;
      background-size: 87px 74px, 121px 101px;
      backdrop-filter: blur(8px);
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }
    .ai-modal-container {
      background: linear-gradient(145deg, rgba(23,19,32,.99), rgba(16,19,43,.99));
      border: 3px double rgba(214,189,116,.68);
      border-radius: 2px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7), 0 0 30px rgba(214, 189, 116, 0.12);
      color: #eee8d8;
      max-width: 760px;
      width: 100%;
      max-height: 92vh;
      overflow-y: auto;
      padding: clamp(16px, 4vw, 28px);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .ai-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid rgba(214, 189, 116, 0.24);
      padding-bottom: 14px;
    }
    .ai-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(214, 189, 116, 0.12);
      border: 1px solid rgba(214,189,116,.35);
      color: #ffd658;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 0;
      margin-bottom: 6px;
    }
    .ai-modal-header h2 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: clamp(1.2rem, 3.5vw, 1.65rem);
      color: #f3e7c1;
      margin: 0 0 4px;
      font-weight: 500;
    }
    .subtitle {
      color: #a49db8;
      font-size: 0.78rem;
      margin: 0;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #d6bd74;
      font-size: 1.8rem;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      transition: color 0.15s;
    }
    .close-btn:hover {
      color: #ff9a91;
    }
    .ai-controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: rgba(214,189,116,.07);
      border: 1px solid rgba(214,189,116,.2);
      padding: 10px 14px;
      border-radius: 2px;
    }
    .difficulty-picker {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: #ead89a;
    }
    .difficulty-picker select {
      background: #0e0d18;
      border: 1px solid rgba(214,189,116,.38);
      border-radius: 2px;
      color: #f3e7c1;
      font-size: 0.78rem;
      padding: 6px 10px;
    }
    .gen-btn {
      background: linear-gradient(135deg,#ead89a,#c59a4a);
      border: none;
      border-radius: 2px;
      color: #201506;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 8px 14px;
      transition: background 0.15s;
    }
    .gen-btn:hover {
      background: #ffd658;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .threat-tag, .vector-tag, .mitre-tag {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .threat-tag.baja { background: rgba(103,230,192,.12); color: #83e3bd; }
    .threat-tag.media { background: rgba(214,189,116,.13); color: #ffd658; }
    .threat-tag.alta, .threat-tag.crítica { background: rgba(255,115,95,.12); color: #ff9a91; }
    .vector-tag { background: rgba(214,189,116,.1); color: #ead89a; }
    .mitre-tag { background: rgba(103, 230, 192, 0.1); color: #83e3bd; font-family: monospace; }
    
    .narrative-box {
      background: #211806;
      border: 1px solid rgba(214,189,116,.3);
      border-radius: 2px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .narrative-box h3 {
      font-size: 1.15rem;
      color: #ffd658;
      font-family: Georgia, 'Times New Roman', serif;
      margin: 0 0 10px;
    }
    .narrative-box .desc {
      font-size: 0.88rem;
      line-height: 1.6;
      color: #c3b58f;
      margin: 0 0 14px;
    }
    .clue-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      background: rgba(9,10,24,.55);
      border: 1px solid rgba(214,189,116,.18);
      border-radius: 2px;
      padding: 12px;
    }
    .clue-item {
      font-size: 0.75rem;
      color: #b1a891;
    }
    .clue-item strong {
      display: block;
      color: #ead89a;
      margin-bottom: 2px;
    }
    .clue-item code {
      background: #0e0d18;
      border: 1px solid rgba(214,189,116,.22);
      padding: 2px 6px;
      border-radius: 4px;
      color: #83e3bd;
      font-size: 0.72rem;
      word-break: break-all;
    }
    .clue-item.full-width {
      grid-column: 1 / -1;
    }
    
    .options-container h4 {
      font-size: 0.95rem;
      color: #f3e7c1;
      font-family: Georgia, 'Times New Roman', serif;
      margin: 0 0 12px;
    }
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .option-card {
      background: #171320;
      border: 1px solid rgba(214,189,116,.28);
      border-radius: 2px;
      padding: 12px 16px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      color: #eee8d8;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease-in-out;
    }
    .option-card:hover {
      background: #211806;
      border-color: #ffd658;
      transform: translateY(-1px);
    }
    .opt-index {
      background: linear-gradient(135deg,#ead89a,#c59a4a);
      color: #201506;
      font-weight: 800;
      font-size: 0.75rem;
      height: 24px;
      width: 24px;
      border-radius: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .opt-text {
      font-size: 0.83rem;
      line-height: 1.5;
    }

    .feedback-container {
      border-radius: 2px;
      padding: 18px;
      animation: fadeIn 0.25s ease-out;
    }
    .feedback-container.success {
      background: rgba(103,230,192,.09);
      border: 1px solid rgba(103,230,192,.35);
    }
    .feedback-container.danger {
      background: rgba(255,115,95,.09);
      border: 1px solid rgba(255,115,95,.35);
    }
    .feedback-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .feedback-header ion-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }
    .feedback-container.success ion-icon { color: #83e3bd; }
    .feedback-container.danger ion-icon { color: #ff9a91; }
    .feedback-header h4 {
      font-size: 1.1rem;
      margin: 0 0 4px;
      color: #f3e7c1;
      font-family: Georgia, 'Times New Roman', serif;
    }
    .consequence {
      font-size: 0.85rem;
      color: #c3b58f;
      margin: 0;
      line-height: 1.45;
    }
    .diagnostic-body {
      background: rgba(9,10,24,.55);
      border: 1px solid rgba(214,189,116,.2);
      border-radius: 2px;
      padding: 14px;
      margin-bottom: 16px;
      font-size: 0.82rem;
      line-height: 1.55;
    }
    .mitre-box {
      border-top: 1px solid rgba(214,189,116,.22);
      padding-top: 10px;
      margin-top: 10px;
      font-size: 0.78rem;
      color: #b1a891;
    }
    .mitre-box p {
      margin: 4px 0;
    }
    .points-earned {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: #83e3bd;
    }
    .feedback-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .action-btn-primary {
      background: linear-gradient(135deg,#ead89a,#c59a4a);
      color: #201506;
      border: 2px double #ffe8a2;
      border-radius: 2px;
      padding: 10px 18px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .action-btn-primary:focus-visible, .action-btn-secondary:focus-visible, .gen-btn:focus-visible, .option-card:focus-visible {
      outline: 3px solid #67e6c0;
      outline-offset: 3px;
    }
    .action-btn-secondary {
      background: rgba(214,189,116,.08);
      color: #ead89a;
      border: 1px solid rgba(214,189,116,.35);
      border-radius: 2px;
      padding: 10px 16px;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .ai-modal-footer {
      border-top: 1px solid rgba(214,189,116,.24);
      padding-top: 10px;
      text-align: center;
      color: #746b84;
      font-size: 0.7rem;
    }

    @media (max-width: 600px) {
      .clue-grid {
        grid-template-columns: 1fr;
      }
      .ai-modal-container {
        padding: 14px;
      }
      .feedback-actions {
        flex-direction: column;
      }
      .action-btn-primary, .action-btn-secondary {
        width: 100%;
        justify-content: center;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class AiChallengeModalComponent implements OnInit {
  private readonly aiService = inject(AiExerciseService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @Output() challengeClosed = new EventEmitter<void>();
  @Output() pointsAwarded = new EventEmitter<{ id: string; puntos: number; correcta: boolean }>();
  @Input() saving = false;
  @Input() saveError = '';
  @Input() savedAwardId = '';

  difficulty: DifficultyLevel = 'medium';
  exercise: AiExercise | null = null;
  selectedOption: AiExerciseOption | null = null;
  selectedAwardId = '';
  loading = false;

  constructor() {
    addIcons({ alertCircle, checkmarkCircle, closeCircle, refresh, shieldCheckmark, sparkles, warning });
  }

  ngOnInit(): void {
    this.generateNew();
  }

  generateNew(): void {
    this.selectedOption = null;
    this.loading = true;
    setTimeout(() => {
      this.exercise = this.aiService.generateRandomExercise(this.difficulty);
      this.loading = false;
      this.changeDetector.markForCheck();
    }, 150);
  }

  selectOption(option: AiExerciseOption): void {
    this.selectedOption = option;
    this.selectedAwardId = crypto.randomUUID();
    this.emitAward();
  }

  retrySaving(): void {
    if (!this.selectedOption || this.saving) return;
    this.emitAward();
  }

  private emitAward(): void {
    if (!this.selectedOption) return;
    this.pointsAwarded.emit({
      id: this.selectedAwardId,
      puntos: this.selectedOption.isCorrect ? 120 : 25,
      correcta: this.selectedOption.isCorrect,
    });
  }

  close(): void {
    this.challengeClosed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('ai-modal-backdrop')) {
      this.close();
    }
  }
}
