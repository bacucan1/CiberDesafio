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
      background: rgba(4, 6, 18, 0.82);
      backdrop-filter: blur(8px);
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }
    .ai-modal-container {
      background: #111427;
      border: 1px solid rgba(136, 117, 246, 0.35);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7), 0 0 30px rgba(103, 230, 192, 0.15);
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 14px;
    }
    .ai-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(103, 230, 192, 0.15);
      color: #67e6c0;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 6px;
    }
    .ai-modal-header h2 {
      font-size: clamp(1.2rem, 3.5vw, 1.65rem);
      color: #fff;
      margin: 0 0 4px;
      font-weight: 800;
    }
    .subtitle {
      color: #a49db8;
      font-size: 0.78rem;
      margin: 0;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #a49db8;
      font-size: 1.8rem;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      transition: color 0.15s;
    }
    .close-btn:hover {
      color: #ff6b81;
    }
    .ai-controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px 14px;
      border-radius: 10px;
    }
    .difficulty-picker {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: #d1c8ea;
    }
    .difficulty-picker select {
      background: #1c203b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: #fff;
      font-size: 0.78rem;
      padding: 6px 10px;
    }
    .gen-btn {
      background: #7453c8;
      border: none;
      border-radius: 8px;
      color: #fff;
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
      background: #8764e0;
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
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .threat-tag.baja { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
    .threat-tag.media { background: rgba(241, 196, 15, 0.2); color: #f1c40f; }
    .threat-tag.alta, .threat-tag.crítica { background: rgba(231, 76, 60, 0.2); color: #e74c3c; }
    .vector-tag { background: rgba(116, 83, 200, 0.2); color: #c4b0f9; }
    .mitre-tag { background: rgba(103, 230, 192, 0.15); color: #67e6c0; font-family: monospace; }
    
    .narrative-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .narrative-box h3 {
      font-size: 1.15rem;
      color: #f7d277;
      margin: 0 0 10px;
    }
    .narrative-box .desc {
      font-size: 0.88rem;
      line-height: 1.6;
      color: #dcd8ea;
      margin: 0 0 14px;
    }
    .clue-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      padding: 12px;
    }
    .clue-item {
      font-size: 0.75rem;
      color: #a49db8;
    }
    .clue-item strong {
      display: block;
      color: #beb6db;
      margin-bottom: 2px;
    }
    .clue-item code {
      background: #1e1933;
      padding: 2px 6px;
      border-radius: 4px;
      color: #67e6c0;
      font-size: 0.72rem;
      word-break: break-all;
    }
    .clue-item.full-width {
      grid-column: 1 / -1;
    }
    
    .options-container h4 {
      font-size: 0.95rem;
      color: #fff;
      margin: 0 0 12px;
    }
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .option-card {
      background: #1b1f3b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
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
      background: #252b52;
      border-color: #8875f6;
      transform: translateY(-1px);
    }
    .opt-index {
      background: #7453c8;
      color: #fff;
      font-weight: 800;
      font-size: 0.75rem;
      height: 24px;
      width: 24px;
      border-radius: 50%;
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
      border-radius: 12px;
      padding: 18px;
      animation: fadeIn 0.25s ease-out;
    }
    .feedback-container.success {
      background: rgba(46, 204, 113, 0.12);
      border: 1px solid rgba(46, 204, 113, 0.4);
    }
    .feedback-container.danger {
      background: rgba(231, 76, 60, 0.12);
      border: 1px solid rgba(231, 76, 60, 0.4);
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
    .feedback-container.success ion-icon { color: #2ecc71; }
    .feedback-container.danger ion-icon { color: #e74c3c; }
    .feedback-header h4 {
      font-size: 1.1rem;
      margin: 0 0 4px;
      color: #fff;
    }
    .consequence {
      font-size: 0.85rem;
      color: #d1c8ea;
      margin: 0;
      line-height: 1.45;
    }
    .diagnostic-body {
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
      font-size: 0.82rem;
      line-height: 1.55;
    }
    .mitre-box {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 10px;
      margin-top: 10px;
      font-size: 0.78rem;
      color: #a49db8;
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
      color: #67e6c0;
    }
    .feedback-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .action-btn-primary {
      background: #287f72;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .action-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #eee8d8;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .ai-modal-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
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
