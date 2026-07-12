import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CardType = {
  id: number;
  color: string;
  shape: 'square' | 'circle' | 'diamond';
  isFlipped: boolean;
  isMatched: boolean;
};

const CARD_DESIGNS: { color: string; shape: CardType['shape'] }[] = [
  { color: '#FF6B6B', shape: 'square' },
  { color: '#4ECDC4', shape: 'circle' },
  { color: '#556FB5', shape: 'diamond' },
  { color: '#F4A261', shape: 'square' },
  { color: '#9B5DE5', shape: 'circle' },
  { color: '#2A9D8F', shape: 'diamond' },
];

const HIGH_SCORE_KEY = 'memoryGame_highScore';

function createShuffledDeck(): CardType[] {
  const pairedDesigns = [...CARD_DESIGNS, ...CARD_DESIGNS];
  const deck: CardType[] = pairedDesigns.map((design, index) => ({
    id: index,
    color: design.color,
    shape: design.shape,
    isFlipped: false,
    isMatched: false,
  }));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// One card, in its own component, so each has its own animation value
function MemoryCard({
  card,
  onPress,
}: {
  card: CardType;
  onPress: () => void;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: card.isFlipped || card.isMatched ? 180 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [card.isFlipped, card.isMatched]);

  useEffect(() => {
    if (card.isMatched) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [card.isMatched]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  function renderShape() {
    if (card.shape === 'circle') {
      return <View style={[styles.shapeBase, styles.circle, { backgroundColor: card.color }]} />;
    }
    if (card.shape === 'diamond') {
      return <View style={[styles.shapeBase, styles.diamond, { backgroundColor: card.color }]} />;
    }
    return <View style={[styles.shapeBase, styles.square, { backgroundColor: card.color }]} />;
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={card.isMatched}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Back face (card back) */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFace,
            { transform: [{ rotateY: frontInterpolate }] },
          ]}
        >
          <View style={styles.cardBack}>
            <View style={styles.cardBackPattern} />
          </View>
        </Animated.View>

        {/* Front face (shape) */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFace,
            styles.cardFaceFront,
            card.isMatched && styles.cardMatched,
            { transform: [{ rotateY: backInterpolate }] },
          ]}
        >
          {renderShape()}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Index() {
  const [cards, setCards] = useState<CardType[]>(createShuffledDeck());
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isRoundComplete, setIsRoundComplete] = useState(false);

  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadHighScore();
  }, []);

  async function loadHighScore() {
    try {
      const savedValue = await AsyncStorage.getItem(HIGH_SCORE_KEY);
      if (savedValue !== null) setHighScore(parseInt(savedValue, 10));
    } catch (error) {
      console.log('Failed to load high score:', error);
    }
  }

  async function saveHighScore(newHighScore: number) {
    try {
      await AsyncStorage.setItem(HIGH_SCORE_KEY, newHighScore.toString());
    } catch (error) {
      console.log('Failed to save high score:', error);
    }
  }

  useEffect(() => {
    if (isRoundComplete) {
      Animated.spring(overlayAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      overlayAnim.setValue(0);
    }
  }, [isRoundComplete]);

  useEffect(() => {
    if (flippedIndices.length !== 2) return;

    const [firstIndex, secondIndex] = flippedIndices;
    const firstCard = cards[firstIndex];
    const secondCard = cards[secondIndex];

    if (firstCard.color === secondCard.color) {
      const updatedCards = cards.map((card, index) =>
        index === firstIndex || index === secondIndex ? { ...card, isMatched: true } : card
      );
      setCards(updatedCards);
      setFlippedIndices([]);

      const allMatched = updatedCards.every((card) => card.isMatched);
      if (allMatched) {
        const newScore = score + 1;
        setScore(newScore);
        setIsRoundComplete(true);

        if (newScore > highScore) {
          setHighScore(newScore);
          saveHighScore(newScore);
        }

        setTimeout(() => {
          setCards(createShuffledDeck());
          setIsRoundComplete(false);
        }, 1800);
      }
    } else {
      const timer = setTimeout(() => {
        setCards((prevCards) =>
          prevCards.map((card, index) =>
            index === firstIndex || index === secondIndex ? { ...card, isFlipped: false } : card
          )
        );
        setFlippedIndices([]);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [flippedIndices]);

  function handleCardPress(index: number) {
    const card = cards[index];
    if (isRoundComplete) return;
    if (card.isFlipped || card.isMatched) return;
    if (flippedIndices.length === 2) return;

    setCards((prevCards) =>
      prevCards.map((c, i) => (i === index ? { ...c, isFlipped: true } : c))
    );
    setFlippedIndices((prev) => [...prev, index]);
  }

  function handleRestartGame() {
    setCards(createShuffledDeck());
    setFlippedIndices([]);
    setScore(0);
    setIsRoundComplete(false);
  }

  return (
    <LinearGradient colors={['#3A1C71', '#D76D77', '#FFAF7B']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Memory Game</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scorePill}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.scorePill}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{highScore}</Text>
          </View>
        </View>

        <View style={styles.boardWrapper}>
          <View style={styles.boardCard}>
            <View style={styles.board}>
              {cards.map((card, index) => (
                <MemoryCard key={card.id} card={card} onPress={() => handleCardPress(index)} />
              ))}
            </View>
          </View>

          {isRoundComplete && (
            <Animated.View
              style={[
                styles.overlay,
                {
                  opacity: overlayAnim,
                  transform: [
                    {
                      scale: overlayAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.7, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.overlayTitle}>Game Complete! 🎉</Text>
              <Text style={styles.overlayScore}>Final Score: {score}</Text>
              <Text style={styles.overlaySubtext}>New game starting...</Text>
            </Animated.View>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRestartGame} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Restart Game</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const CARD_SIZE = 70;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: 'center', paddingTop: 40 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  scoreRow: { flexDirection: 'row', gap: 16, marginTop: 16, marginBottom: 20 },
  scorePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  scoreLabel: { fontSize: 11, color: '#FFF', opacity: 0.8, fontWeight: '600', letterSpacing: 1 },
  scoreValue: { fontSize: 20, color: '#FFF', fontWeight: '800' },
  boardWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' },
  boardCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 16,
  },
  board: {
    width: CARD_SIZE * 4 + 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    margin: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardFace: { position: 'absolute' },
  cardFaceFront: { position: 'relative' },
  cardBack: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#2D2A5A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBackPattern: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardMatched: { opacity: 0.5 },
  shapeBase: { width: 36, height: 36 },
  square: { borderRadius: 8 },
  circle: { borderRadius: 18 },
  diamond: { transform: [{ rotate: '45deg' }], borderRadius: 4 },
  overlay: {
    position: 'absolute',
    top: '38%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 26,
    paddingHorizontal: 36,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  overlayTitle: { fontSize: 22, fontWeight: '800', color: '#2D3142', marginBottom: 8 },
  overlayScore: { fontSize: 18, color: '#D76D77', fontWeight: '700', marginBottom: 4 },
  overlaySubtext: { fontSize: 13, color: '#8D99AE' },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: 30,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  buttonText: { color: '#3A1C71', fontSize: 16, fontWeight: '700' },
});