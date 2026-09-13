import { Injectable, inject } from '@angular/core';
import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { Decision } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class DecisionService {
  private readonly firestore = getFirestore(firebaseApp);

  async guardar(decision: Decision): Promise<void> {
    await addDoc(collection(this.firestore, 'decisiones'), decision);
  }
}