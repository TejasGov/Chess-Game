const body = document.body;
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const boardElement = document.getElementById('chessboard');
const messageElement = document.getElementById('message');
const gameOverModal = document.getElementById('gameOverModal');
const winnerMessage = document.getElementById('winnerMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const actionsPanel = document.getElementById('actions-panel');
const finalResultMessage = document.getElementById('finalResultMessage');
const shareBtn = document.getElementById('shareBtn');
const shareFeedback = document.getElementById('shareFeedback');

let isDarkMode = false;
themeToggleBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    body.classList.toggle('dark-mode', isDarkMode);
    themeToggleBtn.textContent = isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
});

if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        if (!lastWinner) {
            if (shareFeedback) {
                shareFeedback.textContent = 'Finish a game to share your result first.';
            }
            return;
        }

        const shareText = `I just won a game of chess as ${lastWinner} using the Basic Chess Game!`;
        const shareUrl = window.location.href;
        const clipboardMessage = `${shareText} Play here: ${shareUrl}`;
        if (shareFeedback) {
            shareFeedback.textContent = '';
        }

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Basic Chess Game',
                    text: shareText,
                    url: shareUrl
                });
                if (shareFeedback) {
                    shareFeedback.textContent = 'Result shared! 🎉';
                }
                return;
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    if (shareFeedback) {
                        shareFeedback.textContent = 'Share cancelled.';
                    }
                    return;
                }
                // Fall through to clipboard fallback if sharing fails for another reason.
            }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(clipboardMessage);
                if (shareFeedback) {
                    shareFeedback.textContent = 'Result copied to clipboard!';
                }
            } catch (clipboardError) {
                if (shareFeedback) {
                    shareFeedback.textContent = `Copy this message to share: ${clipboardMessage}`;
                }
            }
        } else if (shareFeedback) {
            shareFeedback.textContent = `Copy this message to share: ${clipboardMessage}`;
        }
    });
}

const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let boardState = JSON.parse(JSON.stringify(initialBoard));
let selectedSquare = null;
let currentPlayer = 'white';
let gameOver = false;
let celebrationTimeout = null;
let lastWinner = '';

let hasMoved = {
    'whiteKing': false, 'whiteRookA': false, 'whiteRookH': false,
    'blackKing': false, 'blackRookA': false, 'blackRookH': false
};

const pieceSymbols = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

function isWhite(piece) {
    return piece === piece.toUpperCase() && piece !== '';
}

function isBlack(piece) {
    return piece === piece.toLowerCase() && piece !== '';
}

function getPieceColor(piece) {
    if (isWhite(piece)) return 'white';
    if (isBlack(piece)) return 'black';
    return null;
}

function renderBoard() {
    boardElement.innerHTML = '';
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (row === 8 && col === 8) continue;
            
            if (row === 8) {
                const coord = document.createElement('div');
                coord.classList.add('coords', 'file-coords');
                coord.textContent = files[col];
                boardElement.appendChild(coord);
            } else if (col === 8) {
                const coord = document.createElement('div');
                coord.classList.add('coords', 'rank-coords');
                coord.textContent = ranks[row];
                boardElement.appendChild(coord);
            } else {
                const square = document.createElement('div');
                square.classList.add('square', (row + col) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = row;
                square.dataset.col = col;
                
                const pieceCode = boardState[row][col];
                if (pieceCode) {
                    const pieceElement = document.createElement('span');
                    pieceElement.classList.add('piece');
                    pieceElement.classList.add(isWhite(pieceCode) ? 'white-piece' : 'black-piece');
                    pieceElement.textContent = pieceSymbols[pieceCode];
                    square.appendChild(pieceElement);
                }
                
                square.addEventListener('click', handleSquareClick);
                boardElement.appendChild(square);
            }
        }
    }
}

function updateMessage(message) {
    messageElement.textContent = message;
}

function showVictoryOptions() {
    body.classList.add('actions-visible');
    if (actionsPanel) {
        actionsPanel.setAttribute('aria-hidden', 'false');
    }
    if (shareBtn) {
        shareBtn.focus();
    }
}

function hideVictoryOptions() {
    body.classList.remove('actions-visible');
    if (actionsPanel) {
        actionsPanel.setAttribute('aria-hidden', 'true');
    }
}

function clearConfetti() {
    document.querySelectorAll('.confetti').forEach(confetti => confetti.remove());
}

function createConfetti() {
    clearConfetti();
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.top = '-10px';
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        document.body.appendChild(confetti);
    }
}

function isPathClear(fromRow, fromCol, toRow, toCol, board = boardState) {
    const dRow = Math.sign(toRow - fromRow);
    const dCol = Math.sign(toCol - fromCol);
    let r = fromRow + dRow;
    let c = fromCol + dCol;

    while (r !== toRow || c !== toCol) {
        if (board[r][c] !== '') {
            return false;
        }
        r += dRow;
        c += dCol;
    }
    return true;
}

function isValidMove(fromRow, fromCol, toRow, toCol, board = boardState) {
    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];
    const pieceType = piece.toLowerCase();
    const color = getPieceColor(piece);
    const targetColor = getPieceColor(targetPiece);

    if ((fromRow === toRow && fromCol === toCol) || (targetPiece && color === targetColor)) {
        return false;
    }

    if (pieceType === 'p') {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        if (fromCol === toCol && toRow === fromRow + direction && board[toRow][toCol] === '') {
            return true;
        }
        if (fromCol === toCol && fromRow === startRow && toRow === fromRow + 2 * direction && board[toRow][toCol] === '' && board[fromRow + direction][fromCol] === '') {
            return true;
        }
        if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction && targetPiece && targetColor !== color) {
            return true;
        }
    }

    if (pieceType === 'r') {
        if (fromRow === toRow || fromCol === toCol) {
            return isPathClear(fromRow, fromCol, toRow, toCol, board);
        }
    }

    if (pieceType === 'n') {
        const dRow = Math.abs(fromRow - toRow);
        const dCol = Math.abs(fromCol - toCol);
        return (dRow === 2 && dCol === 1) || (dRow === 1 && dCol === 2);
    }

    if (pieceType === 'b') {
        if (Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol)) {
            return isPathClear(fromRow, fromCol, toRow, toCol, board);
        }
    }

    if (pieceType === 'q') {
        const isRookMove = (fromRow === toRow || fromCol === toCol);
        const isBishopMove = (Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol));
        if (isRookMove || isBishopMove) {
            return isPathClear(fromRow, fromCol, toRow, toCol, board);
        }
    }

    if (pieceType === 'k') {
        if (Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1) {
            return true;
        }
    }
    
    return false;
}

function findKing(color, board = boardState) {
    const kingPiece = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingPiece) {
                return {row: r, col: c};
            }
        }
    }
    return null;
}

function isSquareAttacked(row, col, attackerColor, board = boardState) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceColor(piece) === attackerColor) {
                if (isValidMove(r, c, row, col, board)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isKingInCheck(color, board = boardState) {
    const kingPos = findKing(color, board);
    if (!kingPos) return false;
    const opponentColor = color === 'white' ? 'black' : 'white';
    return isSquareAttacked(kingPos.row, kingPos.col, opponentColor, board);
}

function isCastlingLegal(fromRow, fromCol, toRow, toCol) {
    const color = currentPlayer;
    const kingHasMoved = color === 'white' ? hasMoved.whiteKing : hasMoved.blackKing;
    
    if (isKingInCheck(color) || kingHasMoved) {
        return false;
    }
    
    // Queenside (long) castling
    if (fromCol === 4 && toCol === 2) {
        const rookHasMoved = color === 'white' ? hasMoved.whiteRookA : hasMoved.blackRookA;
        if (rookHasMoved) return false;
        if (!isPathClear(fromRow, fromCol, fromRow, 0)) return false;
        if (isSquareAttacked(fromRow, 4, color === 'white' ? 'black' : 'white') ||
            isSquareAttacked(fromRow, 3, color === 'white' ? 'black' : 'white') ||
            isSquareAttacked(fromRow, 2, color === 'white' ? 'black' : 'white')) {
            return false;
        }
        return true;
    }
    
    // Kingside (short) castling
    if (fromCol === 4 && toCol === 6) {
        const rookHasMoved = color === 'white' ? hasMoved.whiteRookH : hasMoved.blackRookH;
        if (rookHasMoved) return false;
        if (!isPathClear(fromRow, fromCol, fromRow, 7)) return false;
        if (isSquareAttacked(fromRow, 4, color === 'white' ? 'black' : 'white') ||
            isSquareAttacked(fromRow, 5, color === 'white' ? 'black' : 'white') ||
            isSquareAttacked(fromRow, 6, color === 'white' ? 'black' : 'white')) {
            return false;
        }
        return true;
    }
    return false;
}

function hasLegalMoves(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && getPieceColor(piece) === color) {
                const moves = getMovesForPiece(r, c);
                if (moves.length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getMovesForPiece(row, col) {
    const moves = [];
    const piece = boardState[row][col];
    if (!piece) return moves;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(row, col, r, c)) {
                const tempBoard = JSON.parse(JSON.stringify(boardState));
                tempBoard[r][c] = tempBoard[row][col];
                tempBoard[row][col] = '';
                
                if (!isKingInCheck(currentPlayer, tempBoard)) {
                    moves.push({row: r, col: c});
                }
            }
        }
    }
    
    if (piece.toLowerCase() === 'k') {
        if (isCastlingLegal(row, col, row, 2)) {
            moves.push({row: row, col: 2, isCastling: true});
        }
        if (isCastlingLegal(row, col, row, 6)) {
            moves.push({row: row, col: 6, isCastling: true});
        }
    }
    
    return moves;
}

function highlightValidMoves(moves) {
    const allSquares = document.querySelectorAll('.square');
    allSquares.forEach(square => square.classList.remove('selected', 'valid-move', 'valid-capture', 'castling-move'));
    
    moves.forEach(move => {
        const targetSquare = document.querySelector(`[data-row='${move.row}'][data-col='${move.col}']`);
        if (targetSquare) {
            if (move.isCastling) {
                targetSquare.classList.add('castling-move');
            } else {
                const targetPiece = boardState[move.row][move.col];
                if (targetPiece !== '') {
                    targetSquare.classList.add('valid-capture');
                } else {
                    targetSquare.classList.add('valid-move');
                }
            }
        }
    });
}

function handleCastling(fromRow, fromCol, toCol) {
    const kingRow = fromRow;
    const kingCol = fromCol;
    const rookCol = toCol === 6 ? 7 : 0;
    const newRookCol = toCol === 6 ? 5 : 3;
    
    const kingPiece = boardState[kingRow][kingCol];
    const rookPiece = boardState[kingRow][rookCol];

    boardState[kingRow][toCol] = kingPiece;
    boardState[kingRow][newRookCol] = rookPiece;
    boardState[kingRow][kingCol] = '';
    boardState[kingRow][rookCol] = '';

    if (currentPlayer === 'white') {
        hasMoved.whiteKing = true;
        if (rookCol === 0) hasMoved.whiteRookA = true;
        else hasMoved.whiteRookH = true;
    } else {
        hasMoved.blackKing = true;
        if (rookCol === 0) hasMoved.blackRookA = true;
        else hasMoved.blackRookH = true;
    }
}

function endGame(winnerColor) {
    gameOver = true;
    const winnerName = winnerColor.charAt(0).toUpperCase() + winnerColor.slice(1);
    lastWinner = winnerName;
    const victorySummary = `${winnerName} wins! Capture the board and share your victory.`;
    winnerMessage.textContent = `${winnerName} wins!`;
    updateMessage(victorySummary);
    if (shareFeedback) {
        shareFeedback.textContent = '';
    }

    hideVictoryOptions();

    if (celebrationTimeout) {
        clearTimeout(celebrationTimeout);
    }

    gameOverModal.style.display = 'flex';
    gameOverModal.setAttribute('aria-hidden', 'false');
    createConfetti();

    celebrationTimeout = setTimeout(() => {
        gameOverModal.style.display = 'none';
        gameOverModal.setAttribute('aria-hidden', 'true');
        clearConfetti();
        if (finalResultMessage) {
            finalResultMessage.textContent = victorySummary;
        }
        showVictoryOptions();
        celebrationTimeout = null;
    }, 3000);
}

playAgainBtn.addEventListener('click', () => {
    if (celebrationTimeout) {
        clearTimeout(celebrationTimeout);
        celebrationTimeout = null;
    }

    gameOverModal.style.display = 'none';
    gameOverModal.setAttribute('aria-hidden', 'true');
    clearConfetti();
    hideVictoryOptions();

    lastWinner = '';
    if (finalResultMessage) {
        finalResultMessage.textContent = '';
    }
    if (shareFeedback) {
        shareFeedback.textContent = '';
    }

    boardState = JSON.parse(JSON.stringify(initialBoard));
    selectedSquare = null;
    currentPlayer = 'white';
    gameOver = false;
    hasMoved = {
        'whiteKing': false, 'whiteRookA': false, 'whiteRookH': false,
        'blackKing': false, 'blackRookA': false, 'blackRookH': false
    };
    updateMessage("White's Turn");
    renderBoard();
});

function handleSquareClick(event) {
    if (gameOver) return;

    const clickedSquare = event.currentTarget;
    const row = parseInt(clickedSquare.dataset.row);
    const col = parseInt(clickedSquare.dataset.col);
    const piece = boardState[row][col];
    
    if (selectedSquare) {
        const fromRow = parseInt(selectedSquare.dataset.row);
        const fromCol = parseInt(selectedSquare.dataset.col);
        
        if (piece && getPieceColor(piece) === currentPlayer) {
            selectedSquare.classList.remove('selected');
            selectedSquare = clickedSquare;
            selectedSquare.classList.add('selected');
            const validMoves = getMovesForPiece(row, col);
            highlightValidMoves(validMoves);
            return;
        }

        if (boardState[fromRow][fromCol].toLowerCase() === 'k' && Math.abs(fromCol - col) === 2) {
            if (isCastlingLegal(fromRow, fromCol, row, col)) {
                handleCastling(fromRow, fromCol, col);
                currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
                updateMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`);
            } else {
                updateMessage('Invalid castling move!');
            }
        } else if (isValidMove(fromRow, fromCol, row, col)) {
            const movingPiece = boardState[fromRow][fromCol];
            const capturedPiece = boardState[row][col];
            const movingPlayer = currentPlayer;

            const tempBoard = JSON.parse(JSON.stringify(boardState));
            tempBoard[row][col] = tempBoard[fromRow][fromCol];
            tempBoard[fromRow][fromCol] = '';

            if (isKingInCheck(movingPlayer, tempBoard)) {
                updateMessage('Invalid move! Your king would be in check.');
                selectedSquare.classList.remove('selected');
                selectedSquare = null;
                highlightValidMoves([]);
                renderBoard();
                return;
            }

            if (movingPiece.toLowerCase() === 'k') {
                if (movingPlayer === 'white') hasMoved.whiteKing = true;
                else hasMoved.blackKing = true;
            } else if (movingPiece.toLowerCase() === 'r') {
                if (fromCol === 0) {
                    if (movingPlayer === 'white') hasMoved.whiteRookA = true;
                    else hasMoved.blackRookA = true;
                } else if (fromCol === 7) {
                    if (movingPlayer === 'white') hasMoved.whiteRookH = true;
                    else hasMoved.blackRookH = true;
                }
            }

            boardState[row][col] = movingPiece;
            boardState[fromRow][fromCol] = '';

            const capturedKing = capturedPiece && capturedPiece.toLowerCase() === 'k';

            currentPlayer = movingPlayer === 'white' ? 'black' : 'white';

            if (capturedKing) {
                endGame(movingPlayer);
            } else if (isKingInCheck(currentPlayer)) {
                if (!hasLegalMoves(currentPlayer)) {
                    updateMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in Checkmate! Game Over.`);
                    endGame(currentPlayer === 'white' ? 'black' : 'white');
                } else {
                    updateMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in Check!`);
                }
            } else {
                updateMessage(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`);
            }
        } else {
            updateMessage('Invalid move! Try again.');
        }
        
        selectedSquare = null;
        highlightValidMoves([]);
        renderBoard();
        
    } else if (piece && getPieceColor(piece) === currentPlayer) {
        selectedSquare = clickedSquare;
        selectedSquare.classList.add('selected');
        const validMoves = getMovesForPiece(row, col);
        highlightValidMoves(validMoves);
    }
}

hideVictoryOptions();
renderBoard();
